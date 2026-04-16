'use client'

import Link from 'next/link'
import '@/styles/sidebar.css'
import { useLanguage } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

export default function TenantSidebar() {
    const { language, toggleLanguage, t } = useLanguage()
    const router = useRouter()
    const pathname = usePathname()
    const supabase = createClient()

    const navItems = [
        { name: t('dashboard') || 'Dashboard', path: '/tenant/dashboard', icon: '🏠' },
        { name: t('billing') || 'Billing', path: '/tenant/billing', icon: '💰' },
        { name: t('maintenance') || 'Maintenance', path: '/tenant/maintenance', icon: '🔧' },
    ]

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                HoPak Tenant
            </div>
            <nav className="sidebar-nav">
                <div className="sidebar-lang-container">
                    <button
                        onClick={toggleLanguage}
                        className="btn btn-outline sidebar-lang-btn"
                    >
                        🌐 {language === 'en' ? 'English' : 'ภาษาไทย'}
                    </button>
                </div>
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        href={item.path}
                        className={`nav-item ${pathname.includes(item.path) ? 'active' : ''}`}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {item.name}
                    </Link>
                ))}
            </nav>

            <div className="nav-logout-container">
                <button className="nav-item nav-logout-btn" onClick={handleSignOut}>
                    <span className="nav-icon">🚪</span>
                    {t('signOut') || 'Sign Out'}
                </button>
            </div>
        </aside>
    )
}
