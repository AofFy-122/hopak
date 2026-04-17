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

export async function updateRoomAction(formData) {
    const supabase = await createClient()
    const roomId = formData.get('room_id')
    
    const room_number = formData.get('room_number')
    const type = formData.get('type')
    const monthly_price = formData.get('monthly_price')
    const deposit_amount = formData.get('deposit_amount')
    
    if (room_number && type && monthly_price && deposit_amount) {
        await supabase
            .from('rooms')
            .update({
                room_number,
                type,
                monthly_price: parseFloat(monthly_price),
                deposit_amount: parseFloat(deposit_amount)
            })
            .eq('id', roomId)
    }

    const tenantId = formData.get('tenant_id')
    if (tenantId) {
        const first_name = formData.get('first_name')
        const last_name = formData.get('last_name')
        const phone = formData.get('phone')
        const email = formData.get('email')
        
        if (first_name && last_name) {
            await supabase
                .from('tenants')
                .update({
                    first_name,
                    last_name,
                    phone,
                    email
                })
                .eq('id', tenantId)
        }
    }

    revalidatePath(`/rooms/${roomId}`)
    revalidatePath('/rooms')
    return { success: true }
}

export async function deleteRoomAction(formData) {
    const supabase = await createClient()
    const roomId = formData.get('room_id')
    
    const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)
        
    if (error) {
        return { error: error.message }
    }
    
    revalidatePath('/rooms')
    return { success: true }
}

export async function evictTenantAction(formData) {
    const supabase = await createClient()
    const roomId = formData.get('room_id')
    const contractId = formData.get('contract_id')
    
    if (contractId) {
        const { error: contractError } = await supabase
            .from('contracts')
            .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
            .eq('id', contractId)
            
        if (contractError) {
            return { error: contractError.message }
        }
    }
    
    const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'available' })
        .eq('id', roomId)
        
    if (roomError) {
        return { error: roomError.message }
    }
    
    revalidatePath(`/rooms/${roomId}`)
    revalidatePath('/rooms')
    return { success: true }
}
