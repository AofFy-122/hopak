import { createClient } from '@/lib/supabase/server'
import { reportIssueAction, updateIssueStatusAction } from '@/services/maintenanceActions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslation } from '@/lib/i18n'
import '@/styles/maintenance.css'


const ITEMS_PER_PAGE = 10

export default async function MaintenancePage(props) {
    const searchParams = await props.searchParams
    const showAddForm = searchParams?.action === 'new'

    
    const searchQuery = searchParams?.query || ''
    const currentPage = Number(searchParams?.page) || 1

    const { t } = await getTranslation()
    const supabase = await createClient()

    const { data: branches } = await supabase.from('branches').select('id').limit(1)
    const branch_id = branches?.[0]?.id

    let requests = []
    let activeContracts = []
    let totalRequests = 0
    let totalPages = 1

    if (branch_id) {
        
        let queryBuilder = supabase
            .from('maintenance_requests')
            .select('*, rooms!inner(floors!inner(buildings!inner(branch_id)), room_number), tenants!inner(first_name, last_name)', { count: 'exact' })
            .eq('rooms.floors.buildings.branch_id', branch_id)

       
        if (searchQuery) {
            queryBuilder = queryBuilder.ilike('issue_description', `%${searchQuery}%`)
        }

        const from = (currentPage - 1) * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1

        const { data, count } = await queryBuilder
            .order('created_at', { ascending: false })
            .range(from, to)

        requests = data || []
        totalRequests = count || 0
        totalPages = Math.ceil(totalRequests / ITEMS_PER_PAGE)

       
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
                <div className="maintenance-actions">
                    <form action={async () => { 'use server'; redirect('/maintenance?action=new') }}>
                        <button className="btn btn-primary" type="submit">{t('reportIssue') || 'Report Issue'}</button>
                    </form>
                </div>
            </div>

            
            <div className="search-container" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <form method="GET" action="/maintenance" style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
                    <input 
                        type="text" 
                        name="query" 
                        defaultValue={searchQuery} 
                        placeholder="ค้นหาปัญหา เช่น แอร์, น้ำรั่ว..." 
                        className="maintenance-form-input" 
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary">ค้นหา</button>
                    {searchQuery && (
                        <Link href="/maintenance" className="btn btn-outline">ล้าง</Link>
                    )}
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
                        {searchQuery ? 'ไม่พบรายการแจ้งซ่อมที่ค้นหา' : (t('noMaintenanceRequests') || 'No maintenance requests right now. Everything is working fine!')}
                    </div>
                ) : (
                    <>
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

                        
                        {/* Pagination Controls (ปุ่มเลื่อนหน้า) */}
                        
                        {totalPages > 1 && (
                            <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                                    แสดง {requests.length} จากทั้งหมด {totalRequests} รายการ
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {currentPage > 1 ? (
                                        <Link href={`/maintenance?page=${currentPage - 1}${searchQuery ? `&query=${searchQuery}` : ''}`} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }}>
                                            ก่อนหน้า
                                        </Link>
                                    ) : (
                                        <button className="btn btn-outline" disabled style={{ padding: '0.25rem 0.75rem', opacity: 0.5, cursor: 'not-allowed' }}>ก่อนหน้า</button>
                                    )}
                                    
                                    <span style={{ margin: '0 0.5rem', fontWeight: '500' }}>หน้า {currentPage} / {totalPages}</span>
                                    
                                    {currentPage < totalPages ? (
                                        <Link href={`/maintenance?page=${currentPage + 1}${searchQuery ? `&query=${searchQuery}` : ''}`} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }}>
                                            ถัดไป
                                        </Link>
                                    ) : (
                                        <button className="btn btn-outline" disabled style={{ padding: '0.25rem 0.75rem', opacity: 0.5, cursor: 'not-allowed' }}>ถัดไป</button>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}