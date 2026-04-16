import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getTranslation } from '@/lib/i18n'
import '@/styles/rooms.css'

export default async function RoomDetailsPage(props) {
    const params = await props.params
    const roomId = params.id
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

    return (
        <div className="room-detail-container">
            <div className="room-detail-header">
                <Link href="/rooms" className="btn btn-outline room-detail-back-btn">
                    ← {t('back')}
                </Link>
                <h2 className="room-detail-title">{t('roomDetails')}: {room.room_number}</h2>
            </div>

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
                                <div className="occupant-actions">
                                    <Link href={`/tenants/${currentOccupant.tenants.id}`} className="btn btn-outline occupant-actions-btn">
                                        {t('viewProfile')}
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="occupant-vacant-box">
                                <p>{t('roomIsVacant')}</p>
                                <Link href={`/tenants?action=new&room_id=${room.id}`} className="btn btn-primary occupant-vacant-btn">
                                    {t('admitTenant')}
                                </Link>
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
        </div>
    )
}
