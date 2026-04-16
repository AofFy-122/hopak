'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'


export async function createRoomAction(formData) {

    const supabase = await createClient()


    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Unauthorized' }
    }




    const room_number = formData.get('room_number')
    const type = formData.get('type')
    const monthly_price = formData.get('monthly_price')
    const deposit_amount = formData.get('deposit_amount')
    const floor_id = formData.get('floor_id')


    if (!room_number || !type || !monthly_price || !deposit_amount || !floor_id) {
        return { error: 'Missing required fields' }
    }


    const { data, error } = await supabase
        .from('rooms')
        .insert([{
            room_number,
            type,
            monthly_price: parseFloat(monthly_price),
            deposit_amount: parseFloat(deposit_amount),
            floor_id,
            status: 'available'
        }])
        .select()
        .single()

    if (error) {
        console.error('Error creating room:', error)
        return { error: error.message }
    }


    revalidatePath('/rooms')

    return { success: true, data }
}
