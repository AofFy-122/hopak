'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function reportIssueAction(formData) {
    const supabase = await createClient()


    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }


    const room_id = formData.get('room_id')
    const tenant_id = formData.get('tenant_id')
    const issue_description = formData.get('issue_description')

    if (!room_id || !tenant_id || !issue_description) {
        return { error: 'Missing required fields' }
    }


    const { error } = await supabase
        .from('maintenance_requests')
        .insert([{
            room_id,
            tenant_id,
            issue_description,
            status: 'pending'
        }])

    if (error) {
        console.error('Error reporting issue:', error)
        return { error: error.message }
    }

    revalidatePath('/maintenance')
    revalidatePath('/dashboard')

    return { success: true }
}

export async function updateIssueStatusAction(formData) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const id = formData.get('id')
    const status = formData.get('status')

    if (!id || !status) {
        return { error: 'Missing required fields' }
    }

    const { error } = await supabase
        .from('maintenance_requests')
        .update({ status })
        .eq('id', id)

    if (error) {
        console.error('Error updating issue status:', error)
        return { error: error.message }
    }

    revalidatePath('/maintenance')
    revalidatePath('/dashboard')

    return { success: true }
}
