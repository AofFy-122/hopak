import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getTranslation, translations } from '@/lib/i18n'
import ScoreAdjuster from '@/components/behavior/ScoreAdjuster'
import '@/styles/tenants.css'
import '@/styles/dashboard.css'

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

export default async function TenantDetailsPage(props) {
    const params = await props.params
    const tenantId = params.id
    const supabase = await createClient()
    const { t, lang } = await getTranslation()
    const months = lang === 'th' ? MONTHS_TH : MONTHS_EN


    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single()

    if (tenantError || !tenant) {
        notFound()
    }


    const { data: contracts } = await supabase
        .from('contracts')
        .select(`
            *,
            rooms (
                room_number,
                type,
                monthly_price,
                deposit_amount,
                floors (
                    floor_number,
                    buildings ( name )
                )
            )
        `)
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: false })


    let invoices = []
    if (contracts && contracts.length > 0) {
        const contractIds = contracts.map(c => c.id)
        const { data: invoiceData } = await supabase
            .from('invoices')
            .select('*')
            .in('contract_id', contractIds)
            .order('year', { ascending: false })
            .order('month', { ascending: false })

        invoices = invoiceData || []
    }

    // ดึง behavior logs
    const { data: behaviorLogs } = await supabase
        .from('behavior_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10)

    const logs = behaviorLogs || []

    return (
        <div className="tenant-profile-container">
            <div className="tenant-profile-header">
                <Link href="/tenants" className="btn btn-outline tenant-profile-back">
                    ← {t('back')}
                </Link>
                <h2 className="tenant-profile-title">{t('tenantProfile')}</h2>
            </div>

            <div className="tenant-profile-grid">


                <div className="tenant-profile-col">
                    <div className="card tenant-avatar-card">
                        <div className="tenant-avatar">
                            {tenant.first_name[0]}{tenant.last_name[0]}
                        </div>
                        <h3 className="tenant-name">{tenant.first_name} {tenant.last_name}</h3>
                        <p className="tenant-id">ID: ...{tenant.id.slice(-6)}</p>

                        <div className="tenant-info-list">
                            <div>
                                <strong className="tenant-info-label">{t('phone')}</strong>
                                {tenant.phone || '-'}
                            </div>
                            <div>
                                <strong className="tenant-info-label">{t('email')}</strong>
                                {tenant.email || '-'}
                            </div>
                            <div>
                                <strong className="tenant-info-label">{t('registeredDate') || 'Registered'}</strong>
                                {new Date(tenant.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    {/* Behavior Score Card */}
                    {(() => {
                        const MAX_SCORE = 200
                        const score = tenant.behavior_score ?? 100
                        const tierKey = score >= 160 ? 'gold' : score >= 120 ? 'silver' : score >= 80 ? 'bronze' : score >= 40 ? 'green' : 'danger'
                        const tierIcon = score >= 160 ? '🏆' : score >= 120 ? '🥈' : score >= 80 ? '🥉' : score >= 40 ? '✅' : '⚠️'
                        const tierLabel = score >= 160 ? t('tierGold') : score >= 120 ? t('tierSilver') : score >= 80 ? t('tierBronze') : score >= 40 ? t('tierGreen') : t('tierDanger')
                        const pct = Math.min((score / MAX_SCORE) * 100, 100)
                        const radius = 40
                        const circ = 2 * Math.PI * radius
                        const offset = circ - (pct / 100) * circ

                        return (
                            <div className="card admin-score-card">
                                <h3 className="tenant-section-title">{t('behaviorScore')}</h3>
                                <div className="admin-score-content">
                                    <div className="score-ring-wrapper" style={{ margin: '0 auto' }}>
                                        <svg className="score-ring-svg" width="100" height="100" viewBox="0 0 100 100">
                                            <circle className="score-ring-bg" cx="50" cy="50" r={radius} />
                                            <circle
                                                className={`score-ring-fill tier-${tierKey}`}
                                                cx="50"
                                                cy="50"
                                                r={radius}
                                                strokeDasharray={circ}
                                                strokeDashoffset={offset}
                                            />
                                        </svg>
                                        <div className="score-ring-label">
                                            <div className="score-ring-value" style={{ fontSize: '1.5rem' }}>{score}</div>
                                            <div className="score-ring-max">/ {MAX_SCORE}</div>
                                        </div>
                                    </div>
                                    <div className={`score-tier-badge tier-${tierKey}`} style={{ marginTop: '12px' }}>
                                        <span className="score-tier-icon">{tierIcon}</span>
                                        {tierLabel}
                                    </div>
                                    <div className="score-progress-bar" style={{ marginTop: '12px' }}>
                                        <div
                                            className={`score-progress-fill tier-${tierKey}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>

                                    {/* Score Adjustment Buttons */}
                                    <ScoreAdjuster
                                        tenantId={tenantId}
                                        currentScore={score}
                                        translations={translations[lang] || translations['en']}
                                        lang={lang}
                                    />
                                </div>
                            </div>
                        )
                    })()}

                    {/* Behavior Score History */}
                    <div className="card">
                        <h3 className="tenant-section-title">{t('scoreHistory')}</h3>
                        {logs.length > 0 ? (
                            <div className="score-history-list">
                                {logs.map(log => (
                                    <div key={log.id} className="score-log-item">
                                        <span className={`score-log-change ${log.score_change > 0 ? 'positive' : 'negative'}`}>
                                            {log.score_change > 0 ? '+' : ''}{log.score_change}
                                        </span>
                                        <div className="score-log-details">
                                            <div className="score-log-reason">{log.reason}</div>
                                            <div className="score-log-date">
                                                {new Date(log.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="score-history-empty">
                                {t('noScoreHistory')}
                            </div>
                        )}
                    </div>

                </div>


                <div className="tenant-profile-col">


                    <div className="card">
                        <h3 className="tenant-section-title">{t('leaseContracts')}</h3>
                        {contracts && contracts.length > 0 ? (
                            <div className="contract-list">
                                {contracts.map(contract => (
                                    <div key={contract.id} className={`contract-card ${contract.is_active ? 'active' : 'inactive'}`}>
                                        <div className="contract-header">
                                            <div>
                                                <h4 className="contract-room-title">
                                                    {t('room')} {contract.rooms?.room_number} <span className="contract-room-type">({contract.rooms?.type})</span>
                                                </h4>
                                                <div className="contract-room-location">
                                                    {contract.rooms?.floors?.buildings?.name}, {t('floor')} {contract.rooms?.floors?.floor_number}
                                                </div>
                                            </div>
                                            <span className={`badge ${contract.is_active ? 'badge-primary' : 'badge-outline'} contract-badge`}>
                                                {contract.is_active ? t('active') : t('inactive') || 'INACTIVE'}
                                            </span>
                                        </div>

                                        <div className="contract-details-grid">
                                            <div>
                                                <strong className="contract-detail-label">{t('period') || 'Period'}</strong>
                                                {new Date(contract.start_date).toLocaleDateString()} - <br />{new Date(contract.end_date).toLocaleDateString()}
                                            </div>
                                            <div>
                                                <strong className="contract-detail-label">{t('financialDetails')}</strong>
                                                {t('monthlyPrice')}: ฿{parseFloat(contract.rooms?.monthly_price || 0).toLocaleString()}/mo<br />
                                                {t('depositAmount')}: ฿{parseFloat(contract.rooms?.deposit_amount || 0).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="contract-actions">
                                            <Link href={`/rooms/${contract.room_id}`} className="btn btn-outline">
                                                {t('viewRoom')}
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="tenant-id">{t('noContracts') || 'No contracts found for this tenant.'}</p>
                        )}
                    </div>


                    <div className="card">
                        <h3 className="tenant-section-title">{t('billingHistory')}</h3>
                        {invoices && invoices.length > 0 ? (
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>{t('period') || 'Period'}</th>
                                        <th>{t('amount') || 'Amount'}</th>
                                        <th>{t('dueDate')}</th>
                                        <th>{t('status')}</th>
                                        <th className="text-right"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(invoice => (
                                        <tr key={invoice.id}>
                                            <td>{months[invoice.month - 1]} {invoice.year}</td>
                                            <td className="font-medium">฿{parseFloat(invoice.total_amount).toLocaleString()}</td>
                                            <td>{new Date(invoice.due_date).toLocaleDateString()}</td>
                                            <td>
                                                {(() => {
                                                    let displayStatus = invoice.status;
                                                    if (invoice.status === 'pending' && new Date(invoice.due_date) < new Date()) {
                                                        displayStatus = 'overdue';
                                                    }
                                                    return (
                                                        <span className={`badge ${displayStatus === 'paid' ? 'badge-success' : displayStatus === 'overdue' ? 'badge-danger' : 'badge-warning'} status-badge`}>
                                                            {t(displayStatus)?.toUpperCase() || displayStatus.toUpperCase()}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="history-actions text-right">
                                                <Link href={`/billing/${invoice.id}`} className="btn btn-outline">
                                                    {t('view')}
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="history-empty">
                                {t('noBillingRecords') || 'No billing records found.'}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}

