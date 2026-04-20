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
    
    // 1. Get contracts for this room
    const { data: contracts } = await supabase.from('contracts').select('id').eq('room_id', roomId)
    if (contracts && contracts.length > 0) {
        const contractIds = contracts.map(c => c.id)
        
        // 2. Get invoices for these contracts
        const { data: invoices } = await supabase.from('invoices').select('id').in('contract_id', contractIds)
        if (invoices && invoices.length > 0) {
            const invoiceIds = invoices.map(i => i.id)
            
            // Delete invoice dependencies
            await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds)
            await supabase.from('payments').delete().in('invoice_id', invoiceIds)
            
            // Unlink behavior_logs if they belong to these invoices
            await supabase.from('behavior_logs').update({ invoice_id: null }).in('invoice_id', invoiceIds)
            
            // Delete invoices
            await supabase.from('invoices').delete().in('contract_id', contractIds)
        }
        
        // Delete contracts
        await supabase.from('contracts').delete().eq('room_id', roomId)
    }

    // 3. Delete other room dependencies
    await supabase.from('meter_records').delete().eq('room_id', roomId)
    await supabase.from('maintenance_requests').delete().eq('room_id', roomId)

    // 4. Delete the room
    const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId)
        
    if (error) {
        console.error('Error deleting room:', error);
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
