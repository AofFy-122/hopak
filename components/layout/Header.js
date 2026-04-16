'use client'

import '@/styles/header.css'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Header({ user }) {
    const pathname = usePathname()
    const { t } = useLanguage()

    // Determine the page title locally
    // For tenant, we have '/tenant/dashboard', split gives ['','tenant','dashboard']
    const pathParts = pathname.split('/').filter(p => p !== '')
    let rootPath = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'dashboard'
    
    const title = t(rootPath) || (rootPath.charAt(0).toUpperCase() + rootPath.slice(1))

    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('adminUser') || 'Admin User'
    const initial = displayName.charAt(0).toUpperCase()

    return (
        <header className="header">
            <div className="header-title">{title}</div>
            <div className="header-actions">
                <span>{displayName}</span>
                <div className="avatar">{initial}</div>
            </div>
        </header>
    )
}
