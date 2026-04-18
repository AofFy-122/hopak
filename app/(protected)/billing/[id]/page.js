import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { payInvoiceAction } from '@/services/billingService'
import { redirect } from 'next/navigation'
import PrintButton from './PrintButton'
import { getTranslation } from '@/lib/i18n'
import '@/styles/billing.css'

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

export default async function InvoiceDetailsPage(props) {
    const params = await props.params
    const invoiceId = params.id
    const supabase = await createClient()

    const { t, lang } = await getTranslation()
    const months = lang === 'th' ? MONTHS_TH : MONTHS_EN


    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
            *,
            invoice_items(*),
            contracts (
                start_date,
                end_date,
                tenants (
                    id, first_name, last_name, email, phone
                ),
                rooms (
                    id, room_number, type, monthly_price,
                    floors (
                        floor_number,
                        buildings ( name )
                    )
                )
            )
        `)
        .eq('id', invoiceId)
        .single()

    if (invoiceError || !invoice) {
        notFound()
    }

    const contract = invoice.contracts
    const tenant = contract?.tenants
    const room = contract?.rooms


    const { data: meterReading } = await supabase
        .from('meter_records')
        .select('*')
        .eq('room_id', room.id)
        .eq('month', invoice.month)
        .eq('year', invoice.year)
        .single()

    const handlePayInvoice = async () => {
        'use server'
        await payInvoiceAction(invoice.id, invoice.total_amount)
        redirect(`/billing/${invoice.id}`)
    }

    return (
        <div className="invoice-container">
            <div className="invoice-header">
                <Link href="/billing" className="btn btn-outline invoice-back-btn">
                    ← {t('back')}
                </Link>
                <div className="invoice-flex-spacer"></div>
                {invoice.status !== 'paid' && (
                    <form action={handlePayInvoice}>
                        <button type="submit" className="btn btn-primary">{t('markPaid')}</button>
                    </form>
                )}
                <PrintButton />
            </div>

            <div className="card invoice-card">

                <div className="invoice-title-wrapper">
                    <div>
                        <h1 className="invoice-title-h1">{t('invoice') || 'INVOICE'}</h1>
                        <p className="invoice-title-ref">{t('reference') || 'Reference'}: #{invoice.id.split('-')[0].toUpperCase()}</p>
                    </div>
                    <div className="invoice-company">
                        <h2 className="invoice-company-h2">{room?.floors?.buildings?.name || 'Horganice Property'}</h2>
                        <p className="invoice-company-period">
                            {t('billingPeriod') || 'Billing Period'}: {months[invoice.month - 1]} {invoice.year}
                        </p>
                    </div>
                </div>


                <div className="invoice-info-grid">
                    <div>
                        <h3 className="invoice-section-title">{t('billedTo') || 'Billed To'}</h3>
                        <div className="invoice-tenant-name">{tenant?.first_name} {tenant?.last_name}</div>
                        <div className="invoice-tenant-details">
                            {t('room')}: {room?.room_number}<br />
                            {tenant?.phone && <>{tenant.phone}<br /></>}
                            {tenant?.email}
                        </div>
                    </div>
                    <div>
                        <h3 className="invoice-section-title">{t('invoiceDetails') || 'Invoice Details'}</h3>
                        <table className="invoice-details-table">
                            <tbody>
                                <tr>
                                    <td className="invoice-details-label">{t('issueDate') || 'Issue Date'}:</td>
                                    <td className="invoice-details-value">{new Date(invoice.created_at).toLocaleDateString()}</td>
                                </tr>
                                <tr>
                                    <td className="invoice-details-label">{t('dueDate') || 'Due Date'}:</td>
                                    <td className="invoice-details-value">{new Date(invoice.due_date).toLocaleDateString()}</td>
                                </tr>
                                <tr>
                                    <td className="invoice-details-label">{t('status')}:</td>
                                    <td className="invoice-details-value-no-weight">
                                        <span className={`badge invoice-badge ${invoice.status === 'paid' ? 'badge-success' : invoice.status === 'overdue' ? 'badge-danger' : 'badge-warning'}`}>
                                            {t(invoice.status)?.toUpperCase() || invoice.status.toUpperCase()}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>


                <table className="invoice-items-table">
                    <thead>
                        <tr className="invoice-items-tr-head">
                            <th className="invoice-items-th">{t('description') || 'Description'}</th>
                            <th className="invoice-items-th-right">{t('amount') || 'Amount'}</th>
                        </tr>
                    </thead>
                    <tbody className="invoice-items-tbody">
                        <tr>
                            <td className="invoice-item-td">{t('roomRent') || 'Room Rent'} ({room?.type})</td>
                            <td className="invoice-item-td-right">฿{parseFloat(room?.monthly_price || 0).toLocaleString()}</td>
                        </tr>
                        {meterReading && (
                            <>
                                <tr>
                                    <td className="invoice-item-td">{t('waterUsage') || 'Water Usage'} ({meterReading.water_unit} {t('units') || 'units'})</td>
                                    <td className="invoice-item-td-right">฿{parseFloat(meterReading.water_unit * 18).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td className="invoice-item-td">{t('electricityUsage') || 'Electricity Usage'} ({meterReading.electric_unit} {t('units') || 'units'})</td>
                                    <td className="invoice-item-td-right">฿{parseFloat(meterReading.electric_unit * 8).toLocaleString()}</td>
                                </tr>
                            </>
                        )}
                        {invoice.invoice_items?.map((item, idx) => {
                            if (!item.name.toLowerCase().includes('discount') && !item.name.toLowerCase().includes('ส่วนลด')) return null;
                            return (
                                <tr key={'extra-'+idx}>
                                    <td className="invoice-item-td" style={{ color: 'var(--danger)', fontWeight: '500' }}>
                                        {lang === 'th' ? `ส่วนลด 10% (จากการแลก 50 คะแนน)` : item.name}
                                    </td>
                                    <td className="invoice-item-td-right" style={{ color: 'var(--danger)', fontWeight: '500' }}>
                                        -฿{Math.abs(parseFloat(item.amount)).toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>


                <div className="invoice-total-wrapper">
                    <div className="invoice-total-box">
                        <div className="invoice-total-row">
                            <span className="invoice-total-text">{t('grandTotal') || 'Grand Total'}</span>
                            <span className="invoice-total-text">฿{parseFloat(invoice.total_amount).toLocaleString()}</span>
                        </div>
                    </div>
                </div>


                <div className="invoice-footer">
                    {t('paymentNote') || 'Please make the payment by the due date to avoid any late fees.'} <br />
                    {t('thankYouNote') || 'Thank you for staying with us!'}
                </div>
            </div>


            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body { background: white; }
                    .sidebar, .dashboard-header, .btn, form { display: none !important; }
                    .dashboard-content { margin: 0; padding: 0; }
                    .card { box-shadow: none !important; border: none !important; padding: 0 !important; }
                }
            `}} />
        </div>
    )
}
