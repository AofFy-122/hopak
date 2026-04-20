import { createClient } from '@/lib/supabase/server'
import { admitTenantAction } from '@/services/tenantActions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslation } from '@/lib/i18n'
import '@/styles/tenants.css'

// กำหนดจำนวนลูกบ้านที่ต้องการแสดงต่อ 1 หน้า
const ITEMS_PER_PAGE = 10

export default async function TenantsPage(props) {
    const searchParams = await props.searchParams
    const showAddForm = searchParams?.action === 'new'
    
    // รับค่าจาก URL สำหรับ Search และ Pagination
    const searchQuery = searchParams?.query || ''
    const currentPage = Number(searchParams?.page) || 1

    const { t } = await getTranslation()
    const supabase = await createClient()

    const { data: branches } = await supabase.from('branches').select('id').limit(1)
    const branch_id = branches?.[0]?.id

    let tenants = []
    let availableRooms = []
    let totalTenants = 0
    let totalPages = 1

    if (branch_id) {
        // ==========================================
        // 1. ดึงข้อมูลลูกบ้านปัจจุบัน (Tenants)
        // ==========================================
        let tenantQuery = supabase
            .from('tenants')
            .select('*', { count: 'exact' })
            .eq('branch_id', branch_id)

        // เงื่อนไขการค้นหา (ค้นหาจากชื่อ, นามสกุล, อีเมล, หรือเบอร์โทร)
        if (searchQuery) {
            tenantQuery = tenantQuery.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        }

        // คำนวณช่วงข้อมูล (Pagination)
        const from = (currentPage - 1) * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1

        const { data: tenantData, count: tenantCount } = await tenantQuery
            .order('created_at', { ascending: false })
            .range(from, to)
            
        let mergedTenants = tenantData || []
        
        // ==========================================
        // 2. ดึงข้อมูลผู้ใช้ที่รอการอนุมัติ (Pending Users)
        // *หมายเหตุ: หากมีการค้นหา (Search) เราจะทำการ filter ผู้ใช้ที่รอดำเนินการด้วย
        // ==========================================
        const { data: users } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'tenant')
            .order('created_at', { ascending: false })

        if (users) {
            // หา ID ของคนที่เป็นลูกบ้านแล้ว (จะได้ไม่ซ้ำ)
            const existingUserIds = new Set((tenantData || []).map(t => t.user_id).filter(Boolean))
            
            let pendingTenants = users
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

            // ถ้ามีการค้นหา ให้ Filter ข้อมูล Pending ด้วย
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase()
                pendingTenants = pendingTenants.filter(pt => 
                    pt.first_name.toLowerCase().includes(lowerQuery) ||
                    pt.last_name.toLowerCase().includes(lowerQuery) ||
                    (pt.email && pt.email.toLowerCase().includes(lowerQuery)) ||
                    (pt.phone && pt.phone.includes(lowerQuery))
                )
            }
                
            mergedTenants = [...pendingTenants, ...mergedTenants]
            // รวมจำนวนข้อมูลทั้งหมด (Tenant ปัจจุบัน + คนที่รออนุมัติ)
            totalTenants = (tenantCount || 0) + pendingTenants.length
        } else {
            totalTenants = tenantCount || 0
        }
        
        tenants = mergedTenants
        totalPages = Math.ceil(totalTenants / ITEMS_PER_PAGE)

        // ==========================================
        // 3. โหลดรายชื่อห้องว่าง สำหรับฟอร์มเพิ่มลูกบ้าน
        // ==========================================
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

            {/* ========================================== */}
            {/* กล่องค้นหา (Search Bar) */}
            {/* ========================================== */}
            <div className="search-container" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <form method="GET" action="/tenants" style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '500px' }}>
                    <input 
                        type="text" 
                        name="query" 
                        defaultValue={searchQuery} 
                        placeholder="ค้นหาชื่อ, นามสกุล, อีเมล หรือ เบอร์โทร..." 
                        className="tenant-form-input" 
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary">ค้นหา</button>
                    {searchQuery && (
                        <Link href="/tenants" className="btn btn-outline">ล้าง</Link>
                    )}
                </form>
            </div>

            {searchParams?.error && (
                <div className="tenants-error">
                    <strong>Error:</strong> {searchParams.error}
                </div>
            )}

            {/* ฟอร์มเพิ่มลูกบ้าน (ไม่แก้โค้ดตรงนี้) */}
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
                        {searchQuery ? 'ไม่พบข้อมูลลูกบ้านที่ค้นหา' : t('noTenantsFound')}
                    </div>
                ) : (
                    <>
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

                        {/* ========================================== */}
                        {/* Pagination Controls (ปุ่มเลื่อนหน้า) */}
                        {/* ========================================== */}
                        {totalPages > 1 && (
                            <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                                    แสดง {tenants.length} จากทั้งหมด {totalTenants} คน
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {currentPage > 1 ? (
                                        <Link href={`/tenants?page=${currentPage - 1}${searchQuery ? `&query=${searchQuery}` : ''}`} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }}>
                                            ก่อนหน้า
                                        </Link>
                                    ) : (
                                        <button className="btn btn-outline" disabled style={{ padding: '0.25rem 0.75rem', opacity: 0.5, cursor: 'not-allowed' }}>ก่อนหน้า</button>
                                    )}
                                    
                                    <span style={{ margin: '0 0.5rem', fontWeight: '500' }}>หน้า {currentPage} / {totalPages}</span>
                                    
                                    {currentPage < totalPages ? (
                                        <Link href={`/tenants?page=${currentPage + 1}${searchQuery ? `&query=${searchQuery}` : ''}`} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }}>
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