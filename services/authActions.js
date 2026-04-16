'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData) {
    const email = formData.get('email')
    const password = formData.get('password')

    const supabase = await createClient()

    const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single()

    if (userData?.role === 'tenant') {
        redirect('/tenant/dashboard')
    } else {
        redirect('/dashboard')
    }
}

export async function signup(formData) {
    const email = formData.get('email')
    const password = formData.get('password')
    const fullName = formData.get('fullName')

    const role = formData.get('role') || 'tenant'

    const supabase = await createClient()


    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                role: role
            }
        }
    })

    if (error) {
        return { error: error.message }
    }


    if (data.user) {
        const { error: profileError } = await supabase
            .from('users')
            .insert([
                {
                    id: data.user.id,
                    email: data.user.email,
                    full_name: fullName,
                    role: role
                }
            ])

        if (profileError) {
            console.error('Error creating user profile:', profileError)

        }

        if (role === 'tenant') {
            await supabase
                .from('tenants')
                .update({ user_id: data.user.id })
                .eq('email', data.user.email)
        }
    }


    if (role === 'tenant') {
        redirect('/tenant/dashboard')
    } else {
        redirect('/dashboard')
    }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
