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

export async function assignExistingTenantAction(formData) {
    const supabase = await createClient()

    let tenant_id = formData.get('tenant_id')
    const room_id = formData.get('room_id')
    const start_date = formData.get('start_date')
    const end_date = formData.get('end_date')

    if (!tenant_id || !room_id || !start_date || !end_date) {
        return { error: 'Missing required fields' }
    }

    const { data: roomCheck, error: roomCheckError } = await supabase
        .from('rooms')
        .select('status, floors(buildings(branch_id))')
        .eq('id', room_id)
        .single()

    if (roomCheckError || !roomCheck || roomCheck.status !== 'available') {
        return { error: 'This room is not available.' }
    }
    
    // Resolve pending newly-registered users who don't have a tenant profile yet
    if (tenant_id.toString().startsWith('pending-')) {
        const user_id = tenant_id.replace('pending-', '')
        const branch_id = roomCheck.floors?.buildings?.branch_id
        
        const { data: pendingUser } = await supabase.from('users').select('*').eq('id', user_id).single()
        if (!pendingUser) return { error: 'Pending user not found' }
        
        const { data: newTenant, error: tenantError } = await supabase
            .from('tenants')
            .insert([{
                user_id,
                first_name: pendingUser.full_name?.split(' ')[0] || 'Unknown',
                last_name: pendingUser.full_name?.split(' ').slice(1).join(' ') || '',
                email: pendingUser.email,
                phone: pendingUser.phone || '',
                branch_id
            }])
            .select()
            .single()
            
        if (tenantError) return { error: 'Failed to create tenant profile: ' + tenantError.message }
        tenant_id = newTenant.id
    }

    const { error: contractError } = await supabase
        .from('contracts')
        .insert([{
            tenant_id,
            room_id,
            start_date,
            end_date,
            is_active: true
        }])

    if (contractError) {
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
    revalidatePath(`/rooms/${room_id}`)
    revalidatePath('/rooms')
    revalidatePath('/dashboard')

    return { success: true }
}

export async function updateTenantProfileAction(formData) {
    const supabase = await createClient()

    const tenant_id = formData.get('tenant_id')
    const user_id = formData.get('user_id')
    
    const first_name = formData.get('first_name')
    const last_name = formData.get('last_name')
    const phone = formData.get('phone')
    const email = formData.get('email')

    if (!tenant_id || !first_name || !last_name) {
        return { error: 'Missing required fields' }
    }

    // Update tenants table
    const { error: tenantError } = await supabase
        .from('tenants')
        .update({
            first_name,
            last_name,
            phone,
            email
        })
        .eq('id', tenant_id)

    if (tenantError) {
        return { error: tenantError.message }
    }

    // Update users table if user_id is linked
    if (user_id) {
        // Just update full_name, phone. We avoid updating email blindly to avoid auth sync issues unless necessary, but we update full_name and phone in public.users
        const { error: userError } = await supabase
            .from('users')
            .update({
                full_name: `${first_name} ${last_name}`,
                phone
            })
            .eq('id', user_id)
            
        if (userError) {
            console.error('Error updating users table:', userError)
        }
    }

    revalidatePath('/tenant/dashboard')
    revalidatePath('/tenants')
    return { success: true }
}
