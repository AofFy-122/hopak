import { createClient } from '@/lib/supabase/server'
import { getTranslation } from '@/lib/i18n'
import '@/styles/dashboard.css'
import '@/styles/tenants.css'

export default async function TenantDashboardPage() {
    const supabase = await createClient()
    const { t } = await getTranslation()

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

    // === Fetch Behavior Logs ===
    const { data: behaviorLogs } = await supabase
        .from('behavior_logs')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(10)

    const logs = behaviorLogs || []

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
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    {t('tenantProfile') || 'My Profile'}
                </h3>
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
            </div>
        </div>
    )
}
