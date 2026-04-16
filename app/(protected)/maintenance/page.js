import { createClient } from '@/lib/supabase/server'
import { reportIssueAction, updateIssueStatusAction } from '@/services/maintenanceActions'
import { redirect } from 'next/navigation'
import { getTranslation } from '@/lib/i18n'
import '@/styles/maintenance.css'

export default async function MaintenancePage(props) {
    const searchParams = await props.searchParams
    const showAddForm = searchParams?.action === 'new'

    const { t } = await getTranslation()
    const supabase = await createClient()


    const { data: branches } = await supabase.from('branches').select('id').limit(1)
    const branch_id = branches?.[0]?.id

    let requests = []
    let activeContracts = []

    if (branch_id) {
        const { data } = await supabase
            .from('maintenance_requests')
            .select('*, rooms!inner(floors!inner(buildings!inner(branch_id)), room_number), tenants!inner(first_name, last_name)')
            .eq('rooms.floors.buildings.branch_id', branch_id)
            .order('created_at', { ascending: false })
            .limit(20)
        requests = data || []


        const { data: contracts } = await supabase
            .from('contracts')
            .select('tenant_id, room_id, rooms!inner(room_number, floors!inner(buildings!inner(branch_id))), tenants!inner(first_name, last_name)')
            .eq('rooms.floors.buildings.branch_id', branch_id)
            .eq('is_active', true)
        activeContracts = contracts || []
    }

    const closeForm = async () => {
        'use server'
        redirect('/maintenance')
    }

    const handleReportIssue = async (formData) => {
        'use server'

        const roomTenantData = formData.get('room_tenant_id')
        if (roomTenantData) {
            const [room_id, tenant_id] = roomTenantData.split('|')
            formData.set('room_id', room_id)
            formData.set('tenant_id', tenant_id)
        }
        await reportIssueAction(formData)
        redirect('/maintenance')
    }

    const handleUpdateStatus = async (formData) => {
        'use server'
        await updateIssueStatusAction(formData)
        redirect('/maintenance')
    }

    return (
        <div>
            <div className="maintenance-header">
                <h2>{t('maintenanceRequests') || 'Maintenance Requests'}</h2>
                <form action={async () => { 'use server'; redirect('/maintenance?action=new') }}>
                    <button className="btn btn-primary" type="submit">{t('reportIssue') || 'Report Issue'}</button>
                </form>
            </div>

            {showAddForm && (
                <div className="card maintenance-form-card">
                    <h3 className="maintenance-form-title">{t('reportNewIssue') || 'Report New Issue'}</h3>
                    <form action={handleReportIssue} className="maintenance-form-grid">
                        <div>
                            <label className="maintenance-form-label">{t('roomAndTenant') || 'Room & Tenant'}</label>
                            <select name="room_tenant_id" required className="maintenance-form-input">
                                <option value="">{t('selectRoom') || 'Select Room'}</option>
                                {activeContracts.map(c => (
                                    <option key={c.tenant_id + c.room_id} value={`${c.room_id}|${c.tenant_id}`}>
                                        {t('room')} {c.rooms.room_number} - {c.tenants.first_name} {c.tenants.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="maintenance-form-label">{t('issueDescription') || 'Issue Description'}</label>
                            <textarea name="issue_description" required rows={4} className="maintenance-form-input" placeholder={t('issueDescriptionPlaceholder') || "Describe the issue... e.g. Leaking faucet"}></textarea>
                        </div>

                        <div className="maintenance-form-actions">
                            <button type="submit" className="btn btn-primary">{t('submitReport') || 'Submit Report'}</button>
                            <button formAction={closeForm} className="btn btn-outline" formNoValidate>{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {requests.length === 0 ? (
                    <div className="maintenance-empty">
                        {t('noMaintenanceRequests') || 'No maintenance requests right now. Everything is working fine!'}
                    </div>
                ) : (
                    <table className="maintenance-table">
                        <thead>
                            <tr>
                                <th>{t('room')}</th>
                                <th>{t('issue')}</th>
                                <th>{t('tenant')}</th>
                                <th>{t('status')}</th>
                                <th className="text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map(req => (
                                <tr key={req.id}>
                                    <td className="font-bold">{req.rooms?.room_number}</td>
                                    <td>{req.issue_description}</td>
                                    <td>{req.tenants?.first_name} {req.tenants?.last_name}</td>
                                    <td>
                                        <span className={`maintenance-status ${req.status === 'completed' ? 'maintenance-status-completed' : req.status === 'in_progress' ? 'maintenance-status-progress' : 'maintenance-status-pending'}`}>
                                            {t(`status_${req.status}`) || req.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            {req.status === 'pending' && (
                                                <form action={handleUpdateStatus}>
                                                    <input type="hidden" name="id" value={req.id} />
                                                    <input type="hidden" name="status" value="in_progress" />
                                                    <button type="submit" className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.875rem' }}>{t('startProgress') || 'Start'}</button>
                                                </form>
                                            )}
                                            {(req.status === 'pending' || req.status === 'in_progress') && (
                                                <form action={handleUpdateStatus}>
                                                    <input type="hidden" name="id" value={req.id} />
                                                    <input type="hidden" name="status" value="completed" />
                                                    <button type="submit" className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.875rem' }}>{t('markCompleted') || 'Complete'}</button>
                                                </form>
                                            )}
                                        </div>
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
