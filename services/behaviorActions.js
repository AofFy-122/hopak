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
