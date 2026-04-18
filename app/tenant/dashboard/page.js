import { createClient } from '@/lib/supabase/server'
import { getTranslation } from '@/lib/i18n'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { updateTenantProfileAction } from '@/services/tenantActions'
import { redeemDiscountAction } from '@/services/behaviorActions'
import '@/styles/dashboard.css'
import '@/styles/tenants.css'

export default async function TenantDashboardPage(props) {
    const searchParams = await props.searchParams
    const isEditMode = searchParams?.action === 'edit_profile'

    const supabase = await createClient()
    const { t, lang } = await getTranslation()

    const { data: { user } } = await supabase.auth.getUser()

    // 1. Fetch tenant profile by user_id
    let { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

    // 1.5 Auto-link fallback for previously created accounts (Self-healing)
    if (!tenant && user.email) {
        const { data: tenantByEmail } = await supabase
            .from('tenants')
            .select('*')
            .eq('email', user.email)
            .is('user_id', null)
            .maybeSingle()

        if (tenantByEmail) {
            // Link the account on the fly
            await supabase
                .from('tenants')
                .update({ user_id: user.id })
                .eq('id', tenantByEmail.id)
                
            tenant = { ...tenantByEmail, user_id: user.id }
        }
    }

    if (!tenant) {
        return (
            <div className="card text-center" style={{ padding: '3rem', marginTop: '2rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>{t('welcome') || 'Welcome!'}</h2>
                <p style={{ color: 'var(--text-light)' }}>
                    Your account has been created. Please wait for your building administrator 
                    to assign you to a room. Once assigned, your information and bills will appear here.
                </p>
            </div>
        )
    }

    // 2. Fetch active contract and room details
    const { data: contract } = await supabase
        .from('contracts')
        .select(`
            *,
            rooms (
                id, room_number, type, monthly_price,
                floors (
                    floor_number,
                    buildings ( name )
                )
            )
        `)
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .maybeSingle()

    if (!contract) {
        return (
            <div className="card text-center" style={{ padding: '3rem', marginTop: '2rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>{t('welcome') || 'Welcome'}, {tenant.first_name}!</h2>
                <p style={{ color: 'var(--text-light)' }}>
                    You currently do not have an active room contract. 
                    If you believe this is an error, please contact your administrator.
                </p>
            </div>
        )
    }

    const room = contract.rooms
    const building = room?.floors?.buildings?.name

    // 3. Fetch pending invoice for the active contract
    let pendingInvoice = null
    let alreadyRedeemed = false
    
    if (contract) {
        const { data: invoice } = await supabase
            .from('invoices')
            .select('id, month, year, status, total_amount, invoice_items(name)')
            .eq('contract_id', contract.id)
            .eq('status', 'pending')
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(1)
            .maybeSingle()
            
        if (invoice) {
            pendingInvoice = invoice
            if (invoice.invoice_items) {
                alreadyRedeemed = invoice.invoice_items.some(item => item.name.includes('Points Discount'))
            }
        }
    }

    // === Fetch Behavior Logs ===
    const { data: behaviorLogs } = await supabase
        .from('behavior_logs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(10)

    const logs = behaviorLogs || []

    // Check if redeemed this calendar month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: recentDiscountLog } = await supabase
        .from('behavior_logs')
        .select('id')
        .eq('tenant_id', tenant.id)
        .ilike('reason', '%invoice discount%')
        .gte('created_at', startOfMonth.toISOString())
        .limit(1)
        .maybeSingle()

    const redeemedThisMonth = !!recentDiscountLog;

    // === Behavior Score Logic ===
    const MAX_SCORE = 200
    const score = tenant.behavior_score ?? 100

    const getTier = (s) => {
        if (s >= 160) return { key: 'gold', icon: '🏆', tierLabel: t('tierGold') }
        if (s >= 120) return { key: 'silver', icon: '🥈', tierLabel: t('tierSilver') }
        if (s >= 80) return { key: 'bronze', icon: '🥉', tierLabel: t('tierBronze') }
        if (s >= 40) return { key: 'green', icon: '✅', tierLabel: t('tierGreen') }
        return { key: 'danger', icon: '⚠️', tierLabel: t('tierDanger') }
    }

    const getNextTierInfo = (s) => {
        if (s >= 160) return null // Already top tier
        if (s >= 120) return { target: 160, label: t('tierGold') }
        if (s >= 80) return { target: 120, label: t('tierSilver') }
        if (s >= 40) return { target: 80, label: t('tierBronze') }
        return { target: 40, label: t('tierGreen') }
    }

    const tier = getTier(score)
    const nextTier = getNextTierInfo(score)
    const percentage = Math.min((score / MAX_SCORE) * 100, 100)

    // SVG circle calculations
    const radius = 54
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
        <div>
            <h1 className="dashboard-title">{t('overview') || 'Overview'}</h1>
            
            <div className="stats-grid">
                <div className="stat-card">
                    <h3 className="stat-title">{t('room')}</h3>
                    <div className="stat-value">{room?.room_number}</div>
                    <div className="stat-desc">{building} (Floor {room?.floors?.floor_number})</div>
                </div>
                
                <div className="stat-card">
                    <h3 className="stat-title">{t('roomRent') || 'Rent Rate'}</h3>
                    <div className="stat-value">฿{parseFloat(room?.monthly_price || 0).toLocaleString()}</div>
                    <div className="stat-desc">{t('perMonth') || '/ Month'} ({room?.type})</div>
                </div>
                
                <div className="stat-card">
                    <h3 className="stat-title">{t('status')}</h3>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>
                        Active
                    </div>
                    <div className="stat-desc">
                        Since {new Date(contract.start_date).toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* === Behavior Score Section === */}
            <div className="behavior-score-section">
                <h2 className="behavior-score-section-title">{t('behaviorScore')}</h2>
                <div className="behavior-score-card">
                    {/* Circular Score Ring */}
                    <div className="score-ring-wrapper">
                        <svg className="score-ring-svg" width="130" height="130" viewBox="0 0 130 130">
                            <circle className="score-ring-bg" cx="65" cy="65" r={radius} />
                            <circle
                                className={`score-ring-fill tier-${tier.key}`}
                                cx="65"
                                cy="65"
                                r={radius}
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                            />
                        </svg>
                        <div className="score-ring-label">
                            <div className="score-ring-value">{score}</div>
                            <div className="score-ring-max">{t('scoreOutOf')} {MAX_SCORE}</div>
                        </div>
                    </div>

                    {/* Score Details */}
                    <div className="score-details">
                        <div className={`score-tier-badge tier-${tier.key}`}>
                            <span className="score-tier-icon">{tier.icon}</span>
                            {tier.tierLabel}
                        </div>
                        <p className="score-description">
                            {t('behaviorScoreDesc')}
                        </p>
                        
                        {redeemedThisMonth ? (
                            <div style={{ marginTop: '1rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-light)', fontSize: '0.875rem', textAlign: 'center' }}>
                                {lang === 'th' ? 'คุณได้ใช้สิทธิ์แลกส่วนลดของเดือนนี้ไปแล้ว' : 'You have already redeemed your discount for this month.'}
                            </div>
                        ) : score >= 50 && pendingInvoice && !alreadyRedeemed ? (
                            <form action={async (formData) => {
                                'use server';
                                const res = await redeemDiscountAction(formData);
                                if (res?.error) {
                                    redirect(`/tenant/dashboard?error=${encodeURIComponent(res.error)}`);
                                }
                            }} style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                                <input type="hidden" name="tenant_id" value={tenant.id} />
                                <input type="hidden" name="invoice_id" value={pendingInvoice.id} />
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--primary)', backgroundImage: 'linear-gradient(135deg, var(--primary) 0%, #4facfe 100%)', border: 'none' }}>
                                    <span style={{ fontSize: '1.25rem' }}>🎁</span> 
                                    Redeem 50 Pts for 10% Discount
                                </button>
                            </form>
                        ) : null}
                        
                        <div className="score-progress-bar">
                            <div
                                className={`score-progress-fill tier-${tier.key}`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <div className="score-progress-labels">
                            <span>0</span>
                            {nextTier && (
                                <span>{t('nextTier')}: {nextTier.label} — {nextTier.target - score} {t('pointsToNext')}</span>
                            )}
                            <span>{MAX_SCORE}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* === Behavior Score History === */}
            <div className="card" style={{ marginTop: '1.5rem' }}>
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

            <div className="card" style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>
                        {t('tenantProfile') || 'My Profile'}
                    </h3>
                    {!isEditMode && (
                        <Link href="/tenant/dashboard?action=edit_profile" className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                            {t('edit') || 'Edit'}
                        </Link>
                    )}
                </div>
                
                {searchParams?.error && (
                    <div style={{ color: 'red', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
                        <strong>Error:</strong> {searchParams.error}
                    </div>
                )}
                
                {isEditMode ? (
                    <form action={async (formData) => {
                        'use server';
                        const res = await updateTenantProfileAction(formData);
                        if (res?.error) {
                            redirect(`/tenant/dashboard?action=edit_profile&error=${encodeURIComponent(res.error)}`);
                        } else {
                            redirect('/tenant/dashboard');
                        }
                    }}>
                        <input type="hidden" name="tenant_id" value={tenant.id} />
                        <input type="hidden" name="user_id" value={user.id} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                            <div>
                                <label className="tenant-form-label">{t('firstName') || 'First Name'}</label>
                                <input name="first_name" required className="tenant-form-input" defaultValue={tenant.first_name} />
                            </div>
                            <div>
                                <label className="tenant-form-label">{t('lastName') || 'Last Name'}</label>
                                <input name="last_name" required className="tenant-form-input" defaultValue={tenant.last_name} />
                            </div>
                            <div>
                                <label className="tenant-form-label">{t('email') || 'Email'}</label>
                                <input name="email" type="email" required className="tenant-form-input" defaultValue={tenant.email || ''} />
                            </div>
                            <div>
                                <label className="tenant-form-label">{t('phone') || 'Phone'}</label>
                                <input name="phone" className="tenant-form-input" defaultValue={tenant.phone || ''} />
                            </div>
                        </div>
                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                            <button type="submit" className="btn btn-primary">{t('save') || 'Save'}</button>
                            <Link href="/tenant/dashboard" className="btn btn-outline">{t('cancel') || 'Cancel'}</Link>
                        </div>
                    </form>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                        <div>
                            <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Name</div>
                            <div style={{ fontWeight: '500' }}>{tenant.first_name} {tenant.last_name}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Email</div>
                            <div style={{ fontWeight: '500' }}>{tenant.email || '-'}</div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-light)', fontSize: '0.875rem' }}>Phone</div>
                            <div style={{ fontWeight: '500' }}>{tenant.phone || '-'}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
