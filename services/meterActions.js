'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function recordMeterAction(formData) {
    const supabase = await createClient()


    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }


    const room_id = formData.get('room_id')
    const month = formData.get('month')
    const year = formData.get('year')
    const water_unit = formData.get('water_unit')
    const electric_unit = formData.get('electric_unit')

    if (!room_id || !month || !year || !water_unit || !electric_unit) {
        return { error: 'Missing required fields' }
    }


    const monthInt = parseInt(month)
    const yearInt = parseInt(year)
    const waterFloat = parseFloat(water_unit)
    const electricFloat = parseFloat(electric_unit)

    const { data: existing } = await supabase
        .from('meter_records')
        .select('id')
        .eq('room_id', room_id)
        .eq('month', monthInt)
        .eq('year', yearInt)
        .single()

    let dbError = null

    if (existing) {
        const { error } = await supabase
            .from('meter_records')
            .update({
                water_unit: waterFloat,
                electric_unit: electricFloat
            })
            .eq('id', existing.id)
        dbError = error
    } else {
        const { error } = await supabase
            .from('meter_records')
            .insert([{
                room_id,
                month: monthInt,
                year: yearInt,
                water_unit: waterFloat,
                electric_unit: electricFloat
            }])
        dbError = error
    }

    if (dbError) {
        console.error('Error recording meter:', dbError)
        return { error: dbError.message }
    }

    revalidatePath('/billing')

    return { success: true }
}
