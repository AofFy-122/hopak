'use client'

import '@/styles/header.css'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

// 1. นำเข้า ThemeToggle ที่เราสร้างไว้
import ThemeToggle from '@/components/ThemeToggle' 

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

    // 2. คืนค่า (Return) โครงสร้างหน้าตาของ Header ออกไปแค่ตัวเดียว
    return (
        <header className="header">
            <div className="header-title">{title}</div>
            
            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* วางปุ่ม ThemeToggle ไว้ตรงนี้ */}
                <ThemeToggle />
                
                {/* ส่วนแสดงชื่อและรูปโปรไฟล์ของคุณเหมือนเดิม */}
                <span>{displayName}</span>
                <div className="avatar">{initial}</div>
            </div>
        </header>
    )
}