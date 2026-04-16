import { getDashboardStats } from '@/services/dashboardService'
import Link from 'next/link'
import '@/styles/dashboard.css'
import { getTranslation } from '@/lib/i18n'

export default async function DashboardPage() {
    let stats = { occupancyRate: 0, totalRooms: 0, occupiedRooms: 0, overdueCount: 0, monthlyRevenue: 0, pendingMaintenance: 0, paidInvoicesCount: 0, pendingInvoicesCount: 0 }


    const { t, lang } = await getTranslation()

    try {
        stats = await getDashboardStats()
    } catch (err) {
        console.log('Error fetching dashboard stats', err)
    }

    return (
        <div>
            <h2 className="dashboard-title">{t('overview')}</h2>

            <div className="dashboard-stats-grid">

                <div className="card">
                    <h3 className="stat-label">{t('occupancyRate')}</h3>
                    <div className="stat-value primary">
                        {stats.occupancyRate}%
                    </div>
                    <p className="stat-desc">
                        {stats.occupiedRooms} / {stats.totalRooms} {t('roomsOccupied')}
                    </p>
                </div>

                <div className="card">
                    <h3 className="stat-label">{t('monthlyRevenue')}</h3>
                    <div className="stat-value success">
                        ฿{stats.monthlyRevenue.toLocaleString()}
                    </div>
                    <p className="stat-desc">
                        {t('currentMonth')}
                    </p>
                </div>

                <div className="card">
                    <h3 className="stat-label">{t('invoiceStatus')}</h3>
                    <div className="invoice-status-container">
                        <div>
                            <div className="stat-value success invoice-status-value">{stats.paidInvoicesCount}</div>
                            <div className="stat-desc">{t('paid')}</div>
                        </div>
                        <div className="invoice-status-divider">/</div>
                        <div>
                            <div className="stat-value warning invoice-status-value">{stats.pendingInvoicesCount}</div>
                            <div className="stat-desc">{t('unpaid')}</div>
                        </div>
                    </div>
                    <p className="stat-desc invoice-status-desc">
                        {t('currentMonthBilling')}
                    </p>
                </div>

                <div className="card">
                    <h3 className="stat-label">{t('overdueTenants')}</h3>
                    <div className="stat-value danger">
                        {stats.overdueCount}
                    </div>
                    <p className="stat-desc">
                        {t('invoicesPending')}
                    </p>
                </div>

                <div className="card">
                    <h3 className="stat-label">{t('maintenanceRequests')}</h3>
                    <div className="stat-value warning">
                        {stats.pendingMaintenance}
                    </div>
                    <p className="stat-desc">
                        {t('pendingResolution')}
                    </p>
                </div>

            </div>

            <div className="card dashboard-actions-card">
                <h3 className="dashboard-actions-title">{t('quickActions') || 'Quick Actions'}</h3>
                <div className="dashboard-actions-group">
                    <Link href="/tenants?action=new" className="btn btn-primary">{t('admitTenant').replace('+ ', '')}</Link>
                    <Link href="/billing?action=meter" className="btn btn-outline">{t('recordMeter')}</Link>
                    <Link href="/billing?action=invoice" className="btn btn-outline">{t('generateInvoices')}</Link>
                </div>
            </div>
        </div>
    )
}
