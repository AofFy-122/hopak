import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getTranslation } from '@/lib/i18n'
import '@/styles/rooms.css' // Reusing card styles

export default async function TenantMaintenancePage(props) {
    const searchParams = await props.searchParams
    const showAddForm = searchParams?.action === 'new'

    const { t } = await getTranslation()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    // Fetch tenant profile
    let { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

    // Auto-link fallback
    if (!tenant && user.email) {
        const { data: tenantByEmail } = await supabase
            .from('tenants')
            .select('*')
            .eq('email', user.email)
            .is('user_id', null)
            .maybeSingle()

        if (tenantByEmail) {
            await supabase.from('tenants').update({ user_id: user.id }).eq('id', tenantByEmail.id)
            tenant = { ...tenantByEmail, user_id: user.id }
        }
    }

    let requests = []
    let activeRoom = null

    if (tenant) {
        // Find active contract to get room
        const { data: contract } = await supabase
            .from('contracts')
            .select('rooms(id, room_number)')
            .eq('tenant_id', tenant.id)
            .eq('is_active', true)
            .maybeSingle()

        if (contract) {
            activeRoom = contract.rooms

            // Fetch maintenance requests for this room
            const { data } = await supabase
                .from('maintenance_requests')
                .select('*')
                .eq('room_id', activeRoom.id)
                .order('created_at', { ascending: false })
            
            requests = data || []
        }
    }

    const closeForm = async () => {
        'use server'
        redirect('/tenant/maintenance')
    }

    const handleSubmitMaintenance = async (formData) => {
        'use server'
        if (!activeRoom || !tenant) return

        const issue_description = formData.get('issue_description')
        if (!issue_description) return

        const supabase = await createClient()
        const { error } = await supabase
            .from('maintenance_requests')
            .insert([{
                room_id: activeRoom.id,
                tenant_id: tenant.id,
                issue_description,
                status: 'pending'
            }])

        if (!error) {
            revalidatePath('/tenant/maintenance')
            redirect('/tenant/maintenance')
        } else {
            console.error(error)
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>{t('maintenanceRequests') || 'Maintenance'}</h2>
                {activeRoom && (
                    <form action={async () => { 'use server'; redirect('/tenant/maintenance?action=new') }}>
                        <button className="btn btn-primary" type="submit">{t('addRequest') || 'Report Issue'}</button>
                    </form>
                )}
            </div>

            {!tenant || !activeRoom ? (
                <div className="card text-center" style={{ padding: '3rem' }}>
                    <p style={{ color: 'var(--text-light)' }}>
                        You must be assigned to an active room to submit a maintenance request.
                    </p>
                </div>
            ) : null}

            {showAddForm && activeRoom && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>Report New Issue</h3>
                    <form action={handleSubmitMaintenance} style={{ display: 'grid', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>{t('room') || 'Room'}</label>
                            <input disabled value={activeRoom.room_number} className="form-input" style={{ backgroundColor: 'var(--bg-light)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '8px', width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>{t('issueDescription') || 'Description'}</label>
                            <textarea 
                                name="issue_description" 
                                required 
                                rows="4" 
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                                placeholder="Describe the issue..."
                            ></textarea>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button type="submit" className="btn btn-primary">{t('save') || 'Submit'}</button>
                            <button formAction={closeForm} className="btn btn-outline" formNoValidate>{t('cancel') || 'Cancel'}</button>
                        </div>
                    </form>
                </div>
            )}

            {activeRoom && (
                <div className="card">
                    {requests.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
                            No maintenance requests found.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem', color: 'var(--text-light)' }}>{t('date') || 'Date'}</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-light)' }}>{t('issueDescription') || 'Description'}</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-light)' }}>{t('status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map(req => (
                                    <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                                        <td style={{ padding: '1rem' }}>{req.issue_description}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span className={`badge ${req.status === 'completed' ? 'badge-success' : req.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`}>
                                                {t(req.status) || req.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    )
}
