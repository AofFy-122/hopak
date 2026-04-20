import { createClient } from '@/lib/supabase/server'
import { createRoomAction } from '@/services/roomActions'
import { createBuildingAction } from '@/services/buildingActions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslation } from '@/lib/i18n'
import '@/styles/rooms.css'


const ITEMS_PER_PAGE = 10 

export default async function RoomsPage(props) {
    const searchParams = await props.searchParams
    const showAddRoomForm = searchParams?.action === 'new_room'
    const showAddBuildingForm = searchParams?.action === 'new_building'
    
    
    const searchQuery = searchParams?.query || ''
    const currentPage = Number(searchParams?.page) || 1

    const { t } = await getTranslation()
    const supabase = await createClient()

    
    const { data: branches } = await supabase.from('branches').select('id').limit(1)
    let branch_id = branches?.[0]?.id

    if (!branch_id) {
        const { data: newBranch, error: branchErr } = await supabase
            .from('branches')
            .insert([{ name: 'Main HQ' }])
            .select()
            .single()
        if (!branchErr && newBranch) {
            branch_id = newBranch.id
        }
    }

    let floors = []
    let rooms = []
    let totalRooms = 0
    let totalPages = 1

    if (branch_id) {
       
        const { data: floorData } = await supabase
            .from('floors')
            .select('id, floor_number, building_id, buildings!inner(branch_id, name)')
            .eq('buildings.branch_id', branch_id)
            .order('building_id')
            .order('floor_number')
        floors = floorData || []

        
        let queryBuilder = supabase
            .from('rooms')
            .select('*, floors!inner(id, floor_number, buildings!inner(branch_id, name))', { count: 'exact' })
            .eq('floors.buildings.branch_id', branch_id)

        
        if (searchQuery) {
            queryBuilder = queryBuilder.or(`room_number.ilike.%${searchQuery}%,type.ilike.%${searchQuery}%`)
        }

        
        const from = (currentPage - 1) * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1

        const { data, count } = await queryBuilder
            .order('room_number')
            .range(from, to) 

        rooms = data || []
        totalRooms = count || 0
        totalPages = Math.ceil(totalRooms / ITEMS_PER_PAGE)
    }

    
    const closeForm = async () => {
        'use server'
        redirect('/rooms')
    }

    const handleCreateRoom = async (formData) => {
        'use server'
        await createRoomAction(formData)
        redirect('/rooms') 
    }

    const handleCreateBuilding = async (formData) => {
        'use server'
        const res = await createBuildingAction(formData, branch_id)
        if (res && res.error) {
            redirect(`/rooms?action=new_building&error=${encodeURIComponent(res.error)}`)
        } else {
            redirect('/rooms')
        }
    }

    return (
        <div>
            <div className="rooms-header">
                <h2>{t('buildingsAndRooms')}</h2>
                <div className="rooms-header-actions">
                    <form action={async () => { 'use server'; redirect('/rooms?action=new_building') }}>
                        <button className="btn btn-outline" type="submit">{t('addBuilding')}</button>
                    </form>
                    <form action={async () => { 'use server'; redirect('/rooms?action=new_room') }}>
                        <button className="btn btn-primary" type="submit">{t('addRoom')}</button>
                    </form>
                </div>
            </div>

            
           
            
            <div className="search-container" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <form method="GET" action="/rooms" style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
                    <input 
                        type="text" 
                        name="query" 
                        defaultValue={searchQuery} 
                        placeholder="ค้นหาเลขห้อง หรือ ประเภทห้อง..." 
                        className="room-form-input" 
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary">ค้นหา</button>
                    {searchQuery && (
                        <Link href="/rooms" className="btn btn-outline">ล้าง</Link>
                    )}
                </form>
            </div>

            {searchParams?.error && (
                <div className="rooms-error">
                    <strong>Error:</strong> {searchParams.error}
                </div>
            )}

            
            {showAddBuildingForm && (
                <div className="card room-form-card">
                    <h3 className="room-form-title">{t('addBuilding').replace('+ ', '')}</h3>
                    <form action={handleCreateBuilding} className="room-form-grid-1">
                        <div>
                            <label className="room-form-label">{t('buildingName')}</label>
                            <input name="name" required className="room-form-input" placeholder="e.g. Building A" />
                        </div>
                        <div>
                            <label className="room-form-label">{t('floorsCount')}</label>
                            <input name="total_floors" type="number" min="1" required className="room-form-input" placeholder="e.g. 5" />
                            <small className="room-form-small">The system will automatically generate floors 1 to N for this building.</small>
                        </div>

                        <div className="room-form-actions">
                            <button type="submit" className="btn btn-primary">{t('save')}</button>
                            <button formAction={closeForm} className="btn btn-outline" formNoValidate>{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            {showAddRoomForm && (
                <div className="card room-form-card">
                    <h3 className="room-form-title">{t('addRoom').replace('+ ', '')}</h3>
                    {floors.length === 0 ? (
                        <div className="room-form-warning">
                            <strong>Wait!</strong> {t('noRooms')}
                        </div>
                    ) : (
                        <form action={handleCreateRoom} className="room-form-grid-2">
                            <div>
                                <label className="room-form-label">{t('roomNumber')}</label>
                                <input name="room_number" required className="room-form-input" placeholder="e.g. 101" />
                            </div>
                            <div>
                                <label className="room-form-label">{t('roomType')}</label>
                                <select name="type" required className="room-form-input">
                                    <option value="Standard">Standard</option>
                                    <option value="Deluxe">Deluxe</option>
                                    <option value="Suite">Suite</option>
                                </select>
                            </div>
                            <div>
                                <label className="room-form-label">{t('monthlyPrice')} (฿)</label>
                                <input name="monthly_price" type="number" required className="room-form-input" placeholder="5000" />
                            </div>
                            <div>
                                <label className="room-form-label">{t('depositAmount')} (฿)</label>
                                <input name="deposit_amount" type="number" required className="room-form-input" placeholder="10000" />
                            </div>
                            <div className="room-form-full-col">
                                <label className="room-form-label">{t('selectFloor')}</label>
                                <select name="floor_id" required className="room-form-input">
                                    {floors.map(f => (
                                        <option key={f.id} value={f.id}>{f.buildings?.name || 'Building'} - {t('floor')} {f.floor_number}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="room-form-actions-full">
                                <button type="submit" className="btn btn-primary">{t('save')}</button>
                                <button formAction={closeForm} className="btn btn-outline" formNoValidate>{t('cancel')}</button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            <div className="card">
                {rooms.length === 0 ? (
                    <div className="rooms-empty">
                        {searchQuery ? 'ไม่พบข้อมูลห้องที่ค้นหา' : t('noRooms')}
                    </div>
                ) : (
                    <>
                        <table className="rooms-table">
                            <thead>
                                <tr>
                                    <th>{t('room')}</th>
                                    <th>{t('building')} / {t('floor')}</th>
                                    <th>{t('type')}</th>
                                    <th>{t('price')}</th>
                                    <th>{t('status')}</th>
                                    <th className="text-right">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rooms.map(room => (
                                    <tr key={room.id}>
                                        <td className="font-bold">{room.room_number}</td>
                                        <td>{room.floors?.buildings?.name} - {t('floor')} {room.floors?.floor_number}</td>
                                        <td>{room.type}</td>
                                        <td>฿{room.monthly_price}</td>
                                        <td>
                                            <span className={`badge room-badge ${room.status === 'occupied' ? 'badge-primary room-badge-occupied' : 'badge-outline room-badge-available'}`}>
                                                {t(room.status)}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <Link href={`/rooms/${room.id}`} className="btn btn-outline view-room-btn">{t('view')}</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        
                        
                        
                        {totalPages > 1 && (
                            <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                                    แสดง {rooms.length} จากทั้งหมด {totalRooms} ห้อง
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {currentPage > 1 ? (
                                        <Link href={`/rooms?page=${currentPage - 1}${searchQuery ? `&query=${searchQuery}` : ''}`} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }}>
                                            ก่อนหน้า
                                        </Link>
                                    ) : (
                                        <button className="btn btn-outline" disabled style={{ padding: '0.25rem 0.75rem', opacity: 0.5, cursor: 'not-allowed' }}>ก่อนหน้า</button>
                                    )}
                                    
                                    <span style={{ margin: '0 0.5rem', fontWeight: '500' }}>หน้า {currentPage} / {totalPages}</span>
                                    
                                    {currentPage < totalPages ? (
                                        <Link href={`/rooms?page=${currentPage + 1}${searchQuery ? `&query=${searchQuery}` : ''}`} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }}>
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