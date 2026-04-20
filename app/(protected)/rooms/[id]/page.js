import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getTranslation } from '@/lib/i18n'
import { updateRoomAction, deleteRoomAction, evictTenantAction } from '@/services/roomActions'
import { assignExistingTenantAction } from '@/services/tenantActions'
import '@/styles/rooms.css'
export default async function RoomDetailsPage(props) {
    const params = await props.params
    const searchParams = await props.searchParams
    const roomId = params.id
    const isEdit = searchParams?.action === 'edit'
    const isAssign = searchParams?.action === 'assign'
    const supabase = await createClient()
    const { t } = await getTranslation()


    const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select(`
            *,
            floors (
                floor_number,
                buildings (
                    name,
                    branch_id
                )
            )
        `)
        .eq('id', roomId)
        .single()

    if (roomError || !room) {
        notFound()
    }


    let currentOccupant = null
    if (room.status === 'occupied') {
        const { data: contract } = await supabase
            .from('contracts')
            .select(`
                id, start_date, end_date, is_active,
                tenants ( id, first_name, last_name, phone, email )
            `)
            .eq('room_id', roomId)
            .eq('is_active', true)
            .single()

        if (contract) {
            currentOccupant = contract
        }
    }


    const { data: maintenanceReqs } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(5)

    let allTenants = []
    if (room.status === 'available' && isAssign) {
        const branch_id = room.floors?.buildings?.branch_id
        
        const { data: tenantsData } = await supabase
            .from('tenants')
            .select(`
                id, 
                first_name, 
                last_name, 
                email,
                user_id,
                branch_id,
                contracts(is_active)
            `)
            .order('first_name')
            
        if (tenantsData) {
            allTenants = tenantsData.filter(tenant => {
                if (tenant.branch_id && branch_id && tenant.branch_id !== branch_id) return false;
                const activeContracts = tenant.contracts?.filter(c => c.is_active === true) || []
                return activeContracts.length === 0
            })
        }
        
        const { data: pendingUsers } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'tenant')

        if (pendingUsers) {
            const existingUserIds = new Set((tenantsData || []).map(t => t.user_id).filter(Boolean))
            const newTenants = pendingUsers
                .filter(u => !existingUserIds.has(u.id))
                .map(u => ({
                    id: `pending-${u.id}`,
                    first_name: u.full_name?.split(' ')[0] || 'New User',
                    last_name: u.full_name?.split(' ').slice(1).join(' ') || '',
                    email: u.email || '',
                    is_pending: true
                }))
            
            allTenants = [...newTenants, ...allTenants]
        }
    }

    return (
        <div className="room-detail-container">
            <div className="room-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/rooms" className="btn btn-outline room-detail-back-btn">
                        ← {t('back')}
                    </Link>
                    <h2 className="room-detail-title">{t('roomDetails')}: {room.room_number}</h2>
                </div>
                {!isEdit && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link href={`/rooms/${roomId}?action=edit`} className="btn btn-outline">{t('edit')}</Link>
                        <form action={async () => {
                            'use server';
                            const formData = new FormData();
                            formData.append('room_id', roomId);
                            const res = await deleteRoomAction(formData);
                            if (res?.error) {
                                redirect(`/rooms/${roomId}?error=${encodeURIComponent(res.error)}`);
                            } else {
                                redirect('/rooms');
                            }
                        }}>
                            <button type="submit" className="btn btn-outline" style={{ borderColor: 'red', color: 'red' }}>{t('delete')}</button>
                        </form>
                    </div>
                )}
            </div>

            {searchParams?.error && (
                <div className="rooms-error" style={{ marginTop: '1rem' }}>
                    <strong>Error:</strong> {searchParams.error}
                </div>
            )}

            {isEdit ? (
                <div className="card room-form-card" style={{ marginTop: '1rem' }}>
                    <h3 className="room-form-title">{t('edit')}</h3>
                    <form action={async (formData) => {
                        'use server';
                        await updateRoomAction(formData);
                        redirect(`/rooms/${roomId}`);
                    }} className="room-form-grid-2">
                        <input type="hidden" name="room_id" value={roomId} />
                        
                        <div className="room-form-full-col"><h4 style={{ marginBottom: '0.5rem' }}>{t('generalInfo')}</h4></div>
                        
                        <div>
                            <label className="room-form-label">{t('roomNumber')}</label>
                            <input name="room_number" required className="room-form-input" defaultValue={room.room_number} />
                        </div>
                        <div>
                            <label className="room-form-label">{t('roomType')}</label>
                            <select name="type" required className="room-form-input" defaultValue={room.type}>
                                <option value="Standard">Standard</option>
                                <option value="Deluxe">Deluxe</option>
                                <option value="Suite">Suite</option>
                            </select>
                        </div>
                        <div>
                            <label className="room-form-label">{t('monthlyPrice')} (฿)</label>
                            <input name="monthly_price" type="number" required className="room-form-input" defaultValue={room.monthly_price} />
                        </div>
                        <div>
                            <label className="room-form-label">{t('depositAmount')} (฿)</label>
                            <input name="deposit_amount" type="number" required className="room-form-input" defaultValue={room.deposit_amount} />
                        </div>

                        {currentOccupant && (
                            <>
                                <div className="room-form-full-col" style={{ marginTop: '1rem' }}><h4 style={{ marginBottom: '0.5rem' }}>{t('tenantProfile')}</h4></div>
                                <input type="hidden" name="tenant_id" value={currentOccupant.tenants.id} />
                                <div>
                                    <label className="room-form-label">{t('firstName')}</label>
                                    <input name="first_name" required className="room-form-input" defaultValue={currentOccupant.tenants.first_name} />
                                </div>
                                <div>
                                    <label className="room-form-label">{t('lastName')}</label>
                                    <input name="last_name" required className="room-form-input" defaultValue={currentOccupant.tenants.last_name} />
                                </div>
                                <div>
                                    <label className="room-form-label">{t('phone')}</label>
                                    <input name="phone" className="room-form-input" defaultValue={currentOccupant.tenants.phone || ''} />
                                </div>
                                <div>
                                    <label className="room-form-label">{t('email')}</label>
                                    <input name="email" className="room-form-input" defaultValue={currentOccupant.tenants.email || ''} />
                                </div>
                            </>
                        )}

                        <div className="room-form-actions-full" style={{ marginTop: '1rem' }}>
                            <button type="submit" className="btn btn-primary">{t('save')}</button>
                            <Link href={`/rooms/${roomId}`} className="btn btn-outline" style={{ marginLeft: '0.5rem' }}>{t('cancel')}</Link>
                        </div>
                    </form>
                </div>
            ) : isAssign && room.status === 'available' ? (
                <div className="card room-form-card" style={{ marginTop: '1rem' }}>
                    <h3 className="room-form-title">Assign Existing Tenant</h3>
                    <form action={async (formData) => {
                        'use server';
                        const res = await assignExistingTenantAction(formData);
                        if (res?.error) {
                            redirect(`/rooms/${roomId}?action=assign&error=${encodeURIComponent(res.error)}`);
                        } else {
                            redirect(`/rooms/${roomId}`);
                        }
                    }} className="room-form-grid-2">
                        <input type="hidden" name="room_id" value={roomId} />
                        
                        <div className="room-form-full-col">
                            <label className="room-form-label">Select Tenant</label>
                            <select name="tenant_id" required className="room-form-input">
                                <option value="">-- Select a tenant --</option>
                                {allTenants.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.is_pending ? '🆕 ' : ''}{t.first_name} {t.last_name} ({t.email || 'No email'})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="room-form-label">{t('startDate') || 'Start Date'}</label>
                            <input type="date" name="start_date" required className="room-form-input" />
                        </div>
                        <div>
                            <label className="room-form-label">{t('endDate') || 'End Date'}</label>
                            <input type="date" name="end_date" required className="room-form-input" />
                        </div>

                        <div className="room-form-actions-full" style={{ marginTop: '1rem' }}>
                            <button type="submit" className="btn btn-primary">{t('save')}</button>
                            <Link href={`/rooms/${roomId}`} className="btn btn-outline" style={{ marginLeft: '0.5rem' }}>{t('cancel')}</Link>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="room-detail-grid">

                <div className="room-detail-col">
                    <div className="card">
                        <h3 className="card-title">{t('generalInfo')}</h3>
                        <div className="info-grid">
                            <div className="info-label">{t('building')}:</div>
                            <div className="info-value-bold">{room.floors?.buildings?.name || 'N/A'}</div>

                            <div className="info-label">{t('floor')}:</div>
                            <div className="info-value-bold">{room.floors?.floor_number || 'N/A'}</div>

                            <div className="info-label">{t('type')}:</div>
                            <div>{room.type}</div>

                            <div className="info-label">{t('status')}:</div>
                            <div>
                                <span className={`badge room-status-badge ${room.status === 'occupied' ? 'badge-primary room-status-occupied' : room.status === 'maintenance' ? 'badge-warning room-status-maintenance' : 'badge-outline room-status-available'}`}>
                                    {t(room.status).toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="card-title">{t('financialDetails')}</h3>
                        <div className="info-grid-financial">
                            <div className="info-label">{t('monthlyPrice')}:</div>
                            <div className="info-price">฿{parseFloat(room.monthly_price).toLocaleString()}</div>

                            <div className="info-label">{t('requiredDeposit')}:</div>
                            <div>฿{parseFloat(room.deposit_amount).toLocaleString()}</div>
                        </div>
                    </div>
                </div>


                <div className="room-detail-col">
                    <div className="card">
                        <h3 className="card-title">{t('currentOccupancy')}</h3>
                        {currentOccupant ? (
                            <div>
                                <div className="occupant-container">
                                    <h4 className="occupant-name">
                                        {currentOccupant.tenants.first_name} {currentOccupant.tenants.last_name}
                                    </h4>
                                    <div className="occupant-contact">
                                        📞 {currentOccupant.tenants.phone || 'No phone'} <br />
                                        ✉️ {currentOccupant.tenants.email || 'No email'}
                                    </div>
                                </div>
                                <div className="occupant-period-box">
                                    <strong>{t('contractPeriod')}:</strong><br />
                                    {new Date(currentOccupant.start_date).toLocaleDateString()} - {new Date(currentOccupant.end_date).toLocaleDateString()}
                                </div>
                                <div className="occupant-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <Link href={`/tenants/${currentOccupant.tenants.id}`} className="btn btn-outline occupant-actions-btn" style={{ flex: 1 }}>
                                        {t('viewProfile')}
                                    </Link>
                                    <form action={async () => {
                                        'use server';
                                        const formData = new FormData();
                                        formData.append('room_id', roomId);
                                        formData.append('contract_id', currentOccupant.id);
                                        const res = await evictTenantAction(formData);
                                        if (res?.error) {
                                            redirect(`/rooms/${roomId}?error=${encodeURIComponent(res.error)}`);
                                        } else {
                                            redirect(`/rooms/${roomId}`);
                                        }
                                    }} style={{ flex: 1 }}>
                                        <button type="submit" className="btn btn-outline" style={{ borderColor: 'red', color: 'red', width: '100%', height: '100%' }}>
                                            {t('removeTenant') || 'Remove Tenant'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        ) : (
                            <div className="occupant-vacant-box">
                                <p>{t('roomIsVacant')}</p>
                                <Link href={`/tenants?action=new&room_id=${room.id}`} className="btn btn-primary occupant-vacant-btn">
                                    {t('admitTenant')}
                                </Link>
                                {!isAssign && (
                                    <Link href={`/rooms/${room.id}?action=assign`} className="btn btn-outline" style={{ marginTop: '0.5rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
                                        Assign Existing Tenant
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="card">
                        <h3 className="card-title">{t('recentMaintenance')}</h3>
                        {maintenanceReqs && maintenanceReqs.length > 0 ? (
                            <ul className="maintenance-list">
                                {maintenanceReqs.map(req => (
                                    <li key={req.id} className="maintenance-item">
                                        <div>
                                            <div className="maintenance-title">{req.title}</div>
                                            <div className="maintenance-desc">{req.description}</div>
                                            <div className="maintenance-date">{new Date(req.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <span className={`badge maintenance-badge ${req.status === 'resolved' ? 'badge-primary' : 'badge-warning'}`}>
                                            {t(req.status)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="maintenance-empty">
                                {t('noRecentMaintenance')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}
        </div>
    )
}
