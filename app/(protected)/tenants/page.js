import { createClient } from '@/lib/supabase/server'
import { admitTenantAction } from '@/services/tenantActions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslation } from '@/lib/i18n'
import '@/styles/tenants.css'

export default async function TenantsPage(props) {
    const searchParams = await props.searchParams
    const showAddForm = searchParams?.action === 'new'

    const { t } = await getTranslation()
    const supabase = await createClient()


    const { data: branches } = await supabase.from('branches').select('id').limit(1)
    const branch_id = branches?.[0]?.id

    let tenants = []
    let availableRooms = []

    if (branch_id) {
        const { data } = await supabase
            .from('tenants')
            .select('*')
            .eq('branch_id', branch_id)
            .order('created_at', { ascending: false })
            
        const { data: users } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'tenant')
            .order('created_at', { ascending: false })

        let mergedTenants = data || []
        
        if (users) {
            const existingUserIds = new Set((data || []).map(t => t.user_id).filter(Boolean))
            const pendingTenants = users
                .filter(u => !existingUserIds.has(u.id))
                .map(u => ({
                    id: `pending-${u.id}`,
                    is_pending: true,
                    first_name: u.full_name?.split(' ')[0] || 'Unknown',
                    last_name: u.full_name?.split(' ').slice(1).join(' ') || '',
                    email: u.email,
                    phone: u.phone || '',
                    behavior_score: 100,
                    user_id: u.id,
                }))
                
            mergedTenants = [...pendingTenants, ...mergedTenants]
        }
        
        tenants = mergedTenants


        const { data: rooms } = await supabase
            .from('rooms')
            .select('id, room_number, floors!inner(buildings!inner(branch_id))')
            .eq('floors.buildings.branch_id', branch_id)
            .eq('status', 'available')
        availableRooms = rooms || []
    }

    const closeForm = async () => {
        'use server'
        redirect('/tenants')
    }

    const handleAdmitTenant = async (formData) => {
        'use server'
        const res = await admitTenantAction(formData, branch_id)
        if (res && res.error) {
            redirect(`/tenants?action=new&error=${encodeURIComponent(res.error)}`)
        } else {
            redirect('/tenants')
        }
    }

    return (
        <div>
            <div className="tenants-header">
                <h2>{t('tenantsDirectory')}</h2>
                <form action={async () => { 'use server'; redirect('/tenants?action=new') }}>
                    <button className="btn btn-primary" type="submit">{t('admitTenant')}</button>
                </form>
            </div>

            {searchParams?.error && (
                <div className="tenants-error">
                    <strong>Error:</strong> {searchParams.error}
                </div>
            )}

            {showAddForm && (
                <div className="card tenant-form-card">
                    <h3 className="tenant-form-title">{t('admitTenant').replace('+ ', '')}</h3>
                    <form action={handleAdmitTenant} className="tenant-form-grid">
                        <div>
                            <label className="tenant-form-label">{t('firstName')}</label>
                            <input name="first_name" required className="tenant-form-input" placeholder="example" defaultValue={searchParams?.first_name || ''} />
                        </div>
                        <div>
                            <label className="tenant-form-label">{t('lastName')}</label>
                            <input name="last_name" required className="tenant-form-input" placeholder="example" defaultValue={searchParams?.last_name || ''} />
                        </div>
                        <div>
                            <label className="tenant-form-label">{t('email')}</label>
                            <input name="email" type="email" className="tenant-form-input" placeholder="example@example.com" defaultValue={searchParams?.email || ''} />
                        </div>
                        <div>
                            <label className="tenant-form-label">{t('phone')}</label>
                            <input name="phone" className="tenant-form-input" placeholder="0812345678" defaultValue={searchParams?.phone || ''} />
                        </div>
                        <div>
                            <label className="tenant-form-label">{t('assignRoom')}</label>
                            <select name="room_id" required className="tenant-form-input">
                                <option value="">{t('selectAvailableRoom')}</option>
                                {availableRooms.map(r => (
                                    <option key={r.id} value={r.id}>{t('room')} {r.room_number}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="tenant-form-label">{t('startDate')}</label>
                            <input name="start_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="tenant-form-input" />
                        </div>
                        <div>
                            <label className="tenant-form-label">{t('endDate')}</label>
                            <input name="end_date" type="date" required defaultValue={new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]} className="tenant-form-input" />
                        </div>

                        <div className="tenant-form-actions">
                            <button type="submit" className="btn btn-primary">{t('save')} ({t('admitTenant').replace('+ ', '')})</button>
                            <button formAction={closeForm} className="btn btn-outline" formNoValidate>{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {tenants.length === 0 ? (
                    <div className="tenants-empty">
                        {t('noTenantsFound')}
                    </div>
                ) : (
                    <table className="tenants-table">
                        <thead>
                            <tr>
                                <th>{t('name')}</th>
                                <th>{t('phone')}</th>
                                <th>{t('email')}</th>
                                <th>{t('behaviorScore')}</th>
                                <th className="text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(tenant => {
                                const s = tenant.behavior_score ?? 100
                                const tierClass = s >= 160 ? 'tier-gold' : s >= 120 ? 'tier-silver' : s >= 80 ? 'tier-bronze' : s >= 40 ? 'tier-green' : 'tier-danger'
                                const tierIcon = s >= 160 ? '🏆' : s >= 120 ? '🥈' : s >= 80 ? '🥉' : s >= 40 ? '✅' : '⚠️'
                                return (
                                    <tr key={tenant.id}>
                                        <td className="font-bold">{tenant.first_name} {tenant.last_name}</td>
                                        <td>{tenant.phone || '-'}</td>
                                        <td>{tenant.email || '-'}</td>
                                        <td>
                                            <span className={`score-inline-badge ${tierClass}`}>
                                                {tierIcon} {s}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            {tenant.is_pending ? (
                                                <Link href={`/tenants?action=new&email=${encodeURIComponent(tenant.email)}&first_name=${encodeURIComponent(tenant.first_name)}&last_name=${encodeURIComponent(tenant.last_name)}&phone=${encodeURIComponent(tenant.phone || '')}`} className="btn btn-primary">{t('admitTenant') || 'Admit'}</Link>
                                            ) : (
                                                <Link href={`/tenants/${tenant.id}`} className="btn btn-outline view-profile-btn">{t('viewProfile')}</Link>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
