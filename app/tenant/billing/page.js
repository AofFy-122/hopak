import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getTranslation } from '@/lib/i18n'
import '@/styles/billing.css'

export default async function TenantBillingPage() {
    const { t } = await getTranslation()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Fetch tenant profile
    let { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

    // Auto-link fallback
    if (!tenant && user.email) {
        const { data: tenantByEmail } = await supabase
            .from('tenants')
            .select('id')
            .eq('email', user.email)
            .is('user_id', null)
            .maybeSingle()

        if (tenantByEmail) {
            await supabase.from('tenants').update({ user_id: user.id }).eq('id', tenantByEmail.id)
            tenant = { id: tenantByEmail.id }
        }
    }

    let invoices = []

    if (tenant) {
        // Fetch contracts for this tenant
        const { data: contracts } = await supabase
            .from('contracts')
            .select('id, rooms(room_number)')
            .eq('tenant_id', tenant.id)

        if (contracts && contracts.length > 0) {
            const contractIds = contracts.map(c => c.id)
            
            // Map contract room numbers for easy display
            const roomMap = {}
            contracts.forEach(c => { roomMap[c.id] = c.rooms?.room_number })

            const { data } = await supabase
                .from('invoices')
                .select('*')
                .in('contract_id', contractIds)
                .order('created_at', { ascending: false })

            if (data) {
                // Attach room number to invoice for display
                invoices = data.map(inv => ({
                    ...inv,
                    room_number: roomMap[inv.contract_id]
                }))
            }
        }
    }

    return (
        <div>
            <div className="billing-header">
                <h2>{t('billingAndInvoices') || 'My Bills'}</h2>
            </div>

            <div className="card">
                {(!tenant || invoices.length === 0) ? (
                    <div className="billing-empty">
                        {t('noInvoicesGenerated') || 'No invoices found.'}
                    </div>
                ) : (
                    <table className="billing-table">
                        <thead>
                            <tr>
                                <th>{t('room')}</th>
                                <th>{t('period') || 'Period'}</th>
                                <th>{t('amount') || 'Amount'}</th>
                                <th>{t('status')}</th>
                                <th>{t('dueDate')}</th>
                                <th className="text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map(invoice => (
                                <tr key={invoice.id}>
                                    <td className="font-bold">{invoice.room_number}</td>
                                    <td>{invoice.month}/{invoice.year}</td>
                                    <td>฿{parseFloat(invoice.total_amount).toLocaleString()}</td>
                                    <td>
                                        {(() => {
                                            let displayStatus = invoice.status;
                                            if (invoice.status === 'pending' && new Date(invoice.due_date) < new Date()) {
                                                displayStatus = 'overdue';
                                            }
                                            return (
                                                <span className={`billing-status ${displayStatus === 'paid' ? 'billing-status-paid' : displayStatus === 'overdue' ? 'billing-status-overdue' : 'billing-status-warning'}`}>
                                                    {t(displayStatus) || displayStatus.toUpperCase()}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td>{new Date(invoice.due_date).toLocaleDateString()}</td>
                                    <td className="text-right billing-action-cell">
                                        <Link href={`/tenant/billing/${invoice.id}`} className="btn btn-outline billing-sm-btn billing-view-btn">
                                            {t('view')}
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
