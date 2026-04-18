'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function adjustBehaviorScore(tenantId, scoreChange, reason) {
    const supabase = await createClient()

    // ตรวจสอบสิทธิ์
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    if (!tenantId || !scoreChange || !reason) {
        return { error: 'Missing required fields' }
    }

    // ดึงคะแนนปัจจุบัน
    const { data: tenant, error: fetchError } = await supabase
        .from('tenants')
        .select('behavior_score')
        .eq('id', tenantId)
        .single()

    if (fetchError || !tenant) {
        return { error: 'Tenant not found' }
    }

    const currentScore = tenant.behavior_score ?? 100
    const newScore = Math.max(0, Math.min(200, currentScore + scoreChange))

    // อัพเดตคะแนนใน tenants
    const { error: updateError } = await supabase
        .from('tenants')
        .update({ behavior_score: newScore })
        .eq('id', tenantId)

    if (updateError) {
        console.error('Error updating behavior score:', updateError)
        return { error: updateError.message }
    }

    // บันทึก log
    const { error: logError } = await supabase
        .from('behavior_logs')
        .insert([{
            tenant_id: tenantId,
            score_change: scoreChange,
            reason: reason,
            recorded_by: user.id
        }])

    if (logError) {
        console.error('Error inserting behavior log:', logError)
        // ไม่ return error เพราะคะแนนอัพเดตแล้ว
    }

    revalidatePath(`/tenants/${tenantId}`)
    revalidatePath('/tenants')

    return { success: true, newScore }
}

export async function getBehaviorLogs(tenantId) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('behavior_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10)

    if (error) {
        console.error('Error fetching behavior logs:', error)
        return []
    }

    return data || []
}

export async function redeemDiscountAction(formData) {
    const supabase = await createClient()
    const tenantId = formData.get('tenant_id')
    const invoiceId = formData.get('invoice_id')
    
    // 1. Verify tenant has enough points
    const { data: tenant } = await supabase.from('tenants').select('behavior_score').eq('id', tenantId).single()
    if (!tenant || tenant.behavior_score < 50) return { error: 'Not enough points' }
    
    // 2. Verify invoice is pending
    const { data: invoice } = await supabase.from('invoices').select('subtotal, total_amount, status').eq('id', invoiceId).single()
    if (!invoice || invoice.status !== 'pending') return { error: 'Invoice not valid or not pending' }
    
    // 3. Check if discount was already applied
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId)
    if (items && items.some(i => i.name.includes('Points Discount'))) {
        return { error: 'Discount already applied for this invoice' }
    }
    
    const discountAmount = invoice.subtotal * 0.10
    const newTotal = invoice.total_amount - discountAmount
    
    // 4. Update Invoice
    const { error: invError } = await supabase.from('invoices').update({ total_amount: newTotal }).eq('id', invoiceId)
    if (invError) return { error: invError.message }
    
    // 5. Insert Invoice Item
    await supabase.from('invoice_items').insert([{
        invoice_id: invoiceId,
        name: 'Behavior Points Discount (50 Pts)',
        amount: -discountAmount
    }])
    
    // 6. Deduct points from tenant
    const newScore = tenant.behavior_score - 50
    await supabase.from('tenants').update({ behavior_score: newScore }).eq('id', tenantId)
    
    // 7. Record Behavior Log
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('behavior_logs').insert([{
        tenant_id: tenantId,
        score_change: -50,
        reason: 'Redeemed 50 points for 10% invoice discount',
        invoice_id: invoiceId,
        recorded_by: user.id
    }])
    
    revalidatePath('/tenant/dashboard')
    revalidatePath('/tenant/billing')
    revalidatePath('/billing')
    revalidatePath('/tenants')
    revalidatePath(`/tenants/${tenantId}`)
    
    return { success: true }
}
