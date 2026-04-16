'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createBuildingAction(formData, branch_id) {
    const supabase = await createClient()


    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }


    const name = formData.get('name')
    const total_floors = parseInt(formData.get('total_floors'), 10)

    if (!name || isNaN(total_floors) || total_floors < 1 || !branch_id) {
        return { error: 'Missing or invalid required fields' }
    }


    const { data: building, error: buildingError } = await supabase
        .from('buildings')
        .insert([{
            branch_id,
            name
        }])
        .select()
        .single()

    if (buildingError) {
        console.error('Error creating building:', buildingError)
        return { error: buildingError.message }
    }


    const floorsToInsert = []
    for (let i = 1; i <= total_floors; i++) {
        floorsToInsert.push({
            building_id: building.id,
            floor_number: i
        })
    }

    if (floorsToInsert.length > 0) {
        const { error: floorError } = await supabase
            .from('floors')
            .insert(floorsToInsert)

        if (floorError) {
            console.error('Error creating floors:', floorError)
            return { error: floorError.message }
        }
    }

    revalidatePath('/rooms')

    return { success: true }
}
