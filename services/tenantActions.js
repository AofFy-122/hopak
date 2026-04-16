'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function admitTenantAction(formData, branch_id) {
    const supabase = await createClient()


    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }


    const first_name = formData.get('first_name')
    const last_name = formData.get('last_name')
    const email = formData.get('email')
    const phone = formData.get('phone')
    const room_id = formData.get('room_id')
    const start_date = formData.get('start_date')
    const end_date = formData.get('end_date')

    if (!first_name || !last_name || !room_id || !start_date || !end_date || !branch_id) {
        return { error: 'Missing required fields' }
    }


    const { data: roomCheck, error: roomCheckError } = await supabase
        .from('rooms')
        .select('status')
        .eq('id', room_id)
        .single()

    if (roomCheckError || !roomCheck) {
        return { error: 'Could not verify room availability' }
    }

    if (roomCheck.status !== 'available') {
        return { error: 'This room is already occupied by another tenant.' }
    }


    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

    const user_id = existingUser ? existingUser.id : null

    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert([{
            user_id,
            first_name,
            last_name,
            email,
            phone,
            branch_id
        }])
        .select()
        .single()

    if (tenantError) {
        console.error('Error creating tenant:', tenantError)
        return { error: tenantError.message }
    }


    const { error: contractError } = await supabase
        .from('contracts')
        .insert([{
            tenant_id: tenant.id,
            room_id,
            start_date,
            end_date,
            is_active: true
        }])

    if (contractError) {
        console.error('Error creating contract:', contractError)

        return { error: contractError.message }
    }


    const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', room_id)

    if (roomError) {
        console.error('Error updating room status:', roomError)
    }

    revalidatePath('/tenants')
    revalidatePath('/rooms')
    revalidatePath('/dashboard')

    return { success: true }
}
