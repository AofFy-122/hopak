import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateMonthlyInvoices(month, year, branch_id) {
    const supabase = await createClient()


    const { data: contracts, error: contractError } = await supabase
        .from('contracts')
        .select(`
      id,
      room_id,
      tenant_id,
      rooms!inner(
        monthly_price,
        floor_id,
        floors!inner(
          building_id,
          buildings!inner(branch_id)
        )
      )
    `)
        .eq('is_active', true)

        .eq('rooms.floors.buildings.branch_id', branch_id)

    if (contractError) throw new Error(contractError.message)

    const newInvoices = []


    for (const contract of contracts) {

        const { data: existingInvoices } = await supabase
            .from('invoices')
            .select('id, status')
            .eq('contract_id', contract.id)
            .eq('month', month)
            .eq('year', year)
            .limit(1)

        if (existingInvoices && existingInvoices.length > 0) {
            // Skip recreating invoice if it already exists to preserve applied discounts
            continue
        }


        const { data: meterRecord } = await supabase
            .from('meter_records')
            .select('water_unit, electric_unit')
            .eq('room_id', contract.room_id)
            .eq('month', month)
            .eq('year', year)
            .single()

        const rentPrice = parseFloat(contract.rooms.monthly_price)
        let waterCost = 0
        let electricCost = 0


        const WATER_RATE = 18
        const ELECTRIC_RATE = 8

        if (meterRecord) {
            waterCost = parseFloat(meterRecord.water_unit) * WATER_RATE
            electricCost = parseFloat(meterRecord.electric_unit) * ELECTRIC_RATE
        }

        const subtotal = rentPrice + waterCost + electricCost
        const totalAmount = subtotal


        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert([{
                contract_id: contract.id,
                month,
                year,
                subtotal,
                total_amount: totalAmount,
                status: 'pending',
                due_date: new Date(year, month, 5).toISOString()
            }])
            .select()
            .single()

        if (invoiceError) throw new Error(invoiceError.message)


        const items = [
            { invoice_id: invoice.id, name: 'Room Rent', amount: rentPrice }
        ]

        if (waterCost > 0) {
            items.push({ invoice_id: invoice.id, name: 'Water Usage', amount: waterCost })
        }
        if (electricCost > 0) {
            items.push({ invoice_id: invoice.id, name: 'Electricity Usage', amount: electricCost })
        }

        await supabase.from('invoice_items').insert(items)

        newInvoices.push(invoice)
    }

    return newInvoices
}

export async function payInvoiceAction(invoice_id, amount) {
    const supabase = await createClient()


    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }


    const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
            invoice_id,
            amount,
            method: 'cash',
            payment_date: new Date().toISOString()
        }])

    if (paymentError) {
        console.error('Error recording payment:', paymentError)
        return { error: paymentError.message }
    }


    const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', invoice_id)

    if (invoiceError) {
        console.error('Error updating invoice status:', invoiceError)
        return { error: invoiceError.message }
    }


    // Early Payment Behavior Score Bonus
    // จ่ายก่อนวันที่ 4 ของเดือนถัดไป → +10 คะแนน
    try {
        const { data: invoice } = await supabase
            .from('invoices')
            .select('month, year, contract_id')
            .eq('id', invoice_id)
            .single()

        if (invoice) {
            // คำนวณ deadline: วันที่ 4 ของเดือนถัดจากเดือนในบิล
            const billingMonth = invoice.month  // 1-12
            const billingYear = invoice.year
            let deadlineMonth = billingMonth + 1
            let deadlineYear = billingYear
            if (deadlineMonth > 12) {
                deadlineMonth = 1
                deadlineYear += 1
            }
            // Deadline = วันที่ 4 เดือนถัดไป เวลา 23:59:59
            const deadline = new Date(deadlineYear, deadlineMonth - 1, 4, 23, 59, 59)
            const now = new Date()

            // ดึง tenant_id จาก contract
            const { data: contract } = await supabase
                .from('contracts')
                .select('tenant_id')
                .eq('id', invoice.contract_id)
                .single()

            if (contract?.tenant_id) {
                // ดึงคะแนนปัจจุบัน
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('behavior_score')
                    .eq('id', contract.tenant_id)
                    .single()

                const currentScore = tenant?.behavior_score ?? 100

                if (now <= deadline) {
                    // จ่ายตรงเวลา → +10 คะแนน
                    const BONUS_POINTS = 10
                    const newScore = Math.min(200, currentScore + BONUS_POINTS)

                    await supabase
                        .from('tenants')
                        .update({ behavior_score: newScore })
                        .eq('id', contract.tenant_id)

                    await supabase
                        .from('behavior_logs')
                        .insert([{
                            tenant_id: contract.tenant_id,
                            score_change: BONUS_POINTS,
                            reason: `Early payment bonus (${billingMonth}/${billingYear})`,
                            invoice_id: invoice_id,
                            recorded_by: user.id
                        }])
                } else {
                    // จ่ายช้ากว่ากำหนด → -10 คะแนน
                    const PENALTY_POINTS = 10
                    const newScore = Math.max(0, currentScore - PENALTY_POINTS)

                    await supabase
                        .from('tenants')
                        .update({ behavior_score: newScore })
                        .eq('id', contract.tenant_id)

                    await supabase
                        .from('behavior_logs')
                        .insert([{
                            tenant_id: contract.tenant_id,
                            score_change: -PENALTY_POINTS,
                            reason: `Late payment penalty (${billingMonth}/${billingYear})`,
                            invoice_id: invoice_id,
                            recorded_by: user.id
                        }])
                }
            }
        }
    } catch (err) {
        // ไม่ให้ error ของ bonus ทำให้การจ่ายเงินพัง
        console.error('Error processing early payment bonus:', err)
    }


    revalidatePath('/billing')
    revalidatePath('/tenant/billing')
    revalidatePath('/dashboard')
    revalidatePath('/tenants')

    return { success: true }
}

export async function deleteInvoiceAction(invoice_id) {
    const supabase = await createClient()

    // check if invoice had a discount point redemption
    const { data: logs } = await supabase
        .from('behavior_logs')
        .select('*')
        .eq('invoice_id', invoice_id)

    if (logs && logs.length > 0) {
        const discountLog = logs.find(l => l.score_change < 0 && l.reason.includes('invoice discount'));
        if (discountLog) {
            const { data: tenant } = await supabase.from('tenants').select('behavior_score').eq('id', discountLog.tenant_id).single()
            if (tenant) {
                const restoredScore = Math.min(200, tenant.behavior_score + 50);
                await supabase.from('tenants').update({ behavior_score: restoredScore }).eq('id', discountLog.tenant_id)
                
                const { data: { user } } = await supabase.auth.getUser()
                await supabase.from('behavior_logs').insert([{
                    tenant_id: discountLog.tenant_id,
                    score_change: 50,
                    reason: 'Restored 50 points due to invoice deletion',
                    recorded_by: user?.id
                }])
            }
        }
    }

    // Delete related items to satisfy foreign key constraints
    await supabase.from('invoice_items').delete().eq('invoice_id', invoice_id)
    await supabase.from('payments').delete().eq('invoice_id', invoice_id)
    await supabase.from('behavior_logs').delete().eq('invoice_id', invoice_id)

    // Delete the invoice itself
    const { error: invoiceError } = await supabase.from('invoices').delete().eq('id', invoice_id)
    if (invoiceError) {
        console.error('Error deleting invoice:', invoiceError);
        return { error: invoiceError.message }
    }

    revalidatePath('/billing')
    revalidatePath('/tenant/billing')
    revalidatePath('/dashboard')
    revalidatePath('/tenant/dashboard')
    
    return { success: true }
}
