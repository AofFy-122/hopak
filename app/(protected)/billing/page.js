import { createClient } from '@/lib/supabase/server'
import { generateMonthlyInvoices, payInvoiceAction, deleteInvoiceAction } from '@/services/billingService'
import { recordMeterAction } from '@/services/meterActions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslation } from '@/lib/i18n'
import '@/styles/billing.css'


const ITEMS_PER_PAGE = 10

export default async function BillingPage(props) {
    const searchParams = await props.searchParams
    const showMeterForm = searchParams?.action === 'meter'

    // รับค่าจาก URL สำหรับ Search และ Pagination
    const searchQuery = searchParams?.query || ''
    const currentPage = Number(searchParams?.page) || 1

    const { t } = await getTranslation()
    const supabase = await createClient()

    const { data: branches } = await supabase.from('branches').select('id').limit(1)
    const branch_id = branches?.[0]?.id

    let invoices = []
    let activeRooms = []
    let totalInvoices = 0
    let totalPages = 1

    if (branch_id) {
        
        let queryBuilder = supabase
            .from('invoices')
            .select('*, contracts!inner(rooms!inner(floors!inner(buildings!inner(branch_id)), room_number))', { count: 'exact' })
            .eq('contracts.rooms.floors.buildings.branch_id', branch_id)

       
        if (searchQuery) {
            queryBuilder = queryBuilder.ilike('contracts.rooms.room_number', `%${searchQuery}%`)
        }

      
        const from = (currentPage - 1) * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1

        const { data, count } = await queryBuilder
            .order('created_at', { ascending: false })
            .range(from, to)
            
        invoices = data || []
        totalInvoices = count || 0
        totalPages = Math.ceil(totalInvoices / ITEMS_PER_PAGE)

        
        const { data: rooms } = await supabase
            .from('rooms')
            .select('id, room_number, floors!inner(buildings!inner(branch_id))')
            .eq('floors.buildings.branch_id', branch_id)
            .eq('status', 'occupied')
        activeRooms = rooms || []
    }

    
    const closeForm = async () => {
        'use server'
        redirect('/billing')
    }

    const handleRecordMeter = async (formData) => {
        'use server'
        await recordMeterAction(formData)
        redirect('/billing')
    }

    const handleGenerateInvoices = async () => {
        'use server'
        const currentMonth = new Date().getMonth() + 1
        const currentYear = new Date().getFullYear()
        try {
            await generateMonthlyInvoices(currentMonth, currentYear, branch_id)
        } catch (err) {
            console.error(err)
        }
        redirect('/billing')
    }

    const handlePayInvoice = async (formData) => {
        'use server'
        const invoice_id = formData.get('invoice_id')
        const amount = formData.get('amount')
        await payInvoiceAction(invoice_id, amount)
        redirect('/billing')
    }

    const handleDeleteInvoice = async (formData) => {
        'use server'
        const invoice_id = formData.get('invoice_id')
        await deleteInvoiceAction(invoice_id)
        redirect('/billing')
    }

    return (
        <div>
            <div className="billing-header">
                <h2>{t('billingAndInvoices')}</h2>
                <div className="billing-actions">
                    <form action={async () => { 'use server'; redirect('/billing?action=meter') }}>
                        <button className="btn btn-outline" type="submit">{t('recordMeter')}</button>
                    </form>
                    <form action={handleGenerateInvoices}>
                        <button className="btn btn-primary" type="submit">{t('generateInvoices')}</button>
                    </form>
                </div>
            </div>

            
            <div className="search-container" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <form method="GET" action="/billing" style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
                    <input 
                        type="text" 
                        name="query" 
                        defaultValue={searchQuery} 
                        placeholder="ค้นหาจากเลขห้อง..." 
                        className="billing-form-input" 
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary">ค้นหา</button>
                    {searchQuery && (
                        <Link href="/billing" className="btn btn-outline">ล้าง</Link>
                    )}
                </form>
            </div>

            
            {showMeterForm && (
                <div className="card billing-form-card">
                    <h3 className="billing-form-title">{t('recordMeter')}</h3>
                    <form action={handleRecordMeter} className="billing-form-grid">
                        <div className="billing-form-full-width">
                            <label className="billing-form-label">{t('room')}</label>
                            <select name="room_id" required className="billing-form-input">
                                <option value="">{t('selectRoom')}</option>
                                {activeRooms.map(r => (
                                    <option key={r.id} value={r.id}>{t('room')} {r.room_number}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="billing-form-label">{t('month')}</label>
                            <input name="month" type="number" min="1" max="12" required defaultValue={new Date().getMonth() + 1} className="billing-form-input" />
                        </div>
                        <div>
                            <label className="billing-form-label">{t('year')}</label>
                            <input name="year" type="number" required defaultValue={new Date().getFullYear()} className="billing-form-input" />
                        </div>
                        <div>
                            <label className="billing-form-label">{t('waterUnit')}</label>
                            <input name="water_unit" type="number" step="0.01" required className="billing-form-input" placeholder="0" />
                        </div>
                        <div>
                            <label className="billing-form-label">{t('electricUnit')}</label>
                            <input name="electric_unit" type="number" step="0.01" required className="billing-form-input" placeholder="0" />
                        </div>

                        <div className="billing-form-actions">
                            <button type="submit" className="btn btn-primary">{t('saveReading')}</button>
                            <button formAction={closeForm} className="btn btn-outline" formNoValidate>{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {invoices.length === 0 ? (
                    <div className="billing-empty">
                        {searchQuery ? 'ไม่พบบิลสำหรับเลขห้องนี้' : t('noInvoicesGenerated')}
                    </div>
                ) : (
                    <>
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
                                        <td className="font-bold">{invoice.contracts?.rooms?.room_number}</td>
                                        <td>{invoice.month}/{invoice.year}</td>
                                        <td>฿{invoice.total_amount}</td>
                                        <td>
                                            {(() => {
                                                let displayStatus = invoice.status;
                                                if (invoice.status === 'pending' && new Date(invoice.due_date) < new Date()) {
                                                    displayStatus = 'overdue';
                                                }
                                                return (
                                                    <span className={`billing-status ${displayStatus === 'paid' ? 'billing-status-paid' : displayStatus === 'overdue' ? 'billing-status-overdue' : 'billing-status-warning'}`}>
                                                        {t(displayStatus)}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td>{new Date(invoice.due_date).toLocaleDateString()}</td>
                                        <td className="text-right billing-action-cell">
                                            {invoice.status !== 'paid' && (
                                                <form action={handlePayInvoice}>
                                                    <input type="hidden" name="invoice_id" value={invoice.id} />
                                                    <input type="hidden" name="amount" value={invoice.total_amount} />
                                                    <button type="submit" className="btn btn-primary billing-sm-btn">{t('markPaid')}</button>
                                                </form>
                                            )}
                                            <Link href={`/billing/${invoice.id}`} className="btn btn-outline billing-sm-btn billing-view-btn">{t('view')}</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        
                        {/* Pagination Controls (ปุ่มเลื่อนหน้า) */}
                        
                        {totalPages > 1 && (
                            <div className="pagination-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                                    แสดง {invoices.length} จากทั้งหมด {totalInvoices} รายการ
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {currentPage > 1 ? (
                                        <Link href={`/billing?page=${currentPage - 1}${searchQuery ? `&query=${searchQuery}` : ''}`} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }}>
                                            ก่อนหน้า
                                        </Link>
                                    ) : (
                                        <button className="btn btn-outline" disabled style={{ padding: '0.25rem 0.75rem', opacity: 0.5, cursor: 'not-allowed' }}>ก่อนหน้า</button>
                                    )}
                                    
                                    <span style={{ margin: '0 0.5rem', fontWeight: '500' }}>หน้า {currentPage} / {totalPages}</span>
                                    
                                    {currentPage < totalPages ? (
                                        <Link href={`/billing?page=${currentPage + 1}${searchQuery ? `&query=${searchQuery}` : ''}`} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }}>
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