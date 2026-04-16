import { createClient } from '@/lib/supabase/server'

export async function getDashboardStats() {
    try {
        const supabase = await createClient()


        const { data: branches } = await supabase.from('branches').select('id').limit(1)
        const branch_id = branches?.[0]?.id

        if (!branch_id) {
            return { occupancyRate: 0, totalRooms: 0, occupiedRooms: 0, overdueCount: 0, monthlyRevenue: 0, pendingMaintenance: 0 }
        }


        const { data: rooms } = await supabase
            .from('rooms')
            .select('id, status, floors!inner(buildings!inner(branch_id))')
            .eq('floors.buildings.branch_id', branch_id)

        const totalRooms = rooms?.length || 0
        const occupiedRooms = rooms?.filter(r => r.status === 'occupied').length || 0
        const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : 0


        const now = new Date().toISOString()
        const { data: overdueInvoices } = await supabase
            .from('invoices')
            .select('id, total_amount, contract_id, contracts!inner(tenant_id, rooms!inner(floors!inner(buildings!inner(branch_id))))')
            .in('status', ['pending', 'overdue'])
            .lt('due_date', now)
            .eq('contracts.rooms.floors.buildings.branch_id', branch_id)

        const overdueCount = overdueInvoices?.length || 0


        const currentMonth = new Date().getMonth() + 1
        const currentYear = new Date().getFullYear()

        const { data: payments } = await supabase
            .from('payments')
            .select('amount, invoices!inner(month, year, contracts!inner(rooms!inner(floors!inner(buildings!inner(branch_id)))))')
            .eq('invoices.month', currentMonth)
            .eq('invoices.year', currentYear)
            .eq('invoices.contracts.rooms.floors.buildings.branch_id', branch_id)

        const monthlyRevenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0


        const { data: maintenanceReqs } = await supabase
            .from('maintenance_requests')
            .select('id, rooms!inner(floors!inner(buildings!inner(branch_id)))')
            .eq('status', 'pending')
            .eq('rooms.floors.buildings.branch_id', branch_id)

        const pendingMaintenance = maintenanceReqs?.length || 0


        const { data: thisMonthInvoices } = await supabase
            .from('invoices')
            .select('id, status, contracts!inner(rooms!inner(floors!inner(buildings!inner(branch_id))))')
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .eq('contracts.rooms.floors.buildings.branch_id', branch_id)

        const paidInvoicesCount = thisMonthInvoices?.filter(i => i.status === 'paid').length || 0
        const pendingInvoicesCount = thisMonthInvoices?.filter(i => i.status === 'pending' || i.status === 'overdue').length || 0

        return {
            occupancyRate,
            totalRooms,
            occupiedRooms,
            overdueCount,
            monthlyRevenue,
            pendingMaintenance,
            paidInvoicesCount,
            pendingInvoicesCount
        }
    } catch (err) {
        console.error('getDashboardStats Error:', err)
        return { occupancyRate: 0, totalRooms: 0, occupiedRooms: 0, overdueCount: 0, monthlyRevenue: 0, pendingMaintenance: 0, paidInvoicesCount: 0, pendingInvoicesCount: 0 }
    }
}
