'use client'

import Link from 'next/link'
import styles from './landing.module.css'
import { useLanguage } from '@/contexts/LanguageContext'

// 1. นำเข้า ThemeToggle
import ThemeToggle from '@/components/ThemeToggle'

export default function Home() {
  const { t, language, toggleLanguage } = useLanguage()

  return (
    <div className={styles['landing-container']}>
      <header className={styles['landing-header']}>
        <div className={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/0000">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          HoPak
        </div>

        <nav className={styles['nav-links']}>
          <Link href="#features" className={styles['nav-link']}>{t('features') || 'Features'}</Link>
          <Link href="#pricing" className={styles['nav-link']}>{t('pricing') || 'Pricing'}</Link>
          <Link href="#contact" className={styles['nav-link']}>{t('contactLink') || 'Contact'}</Link>
        </nav>

        <div className={styles['auth-buttons']}>
          {/* 2. วางปุ่มสลับธีมไว้ตรงนี้ (ก่อนปุ่มภาษา) */}
          <ThemeToggle />

          <button
            onClick={toggleLanguage}
            className={`btn btn-outline ${styles['lang-btn']}`}
          >
            🌐 {language === 'en' ? 'English' : 'ภาษาไทย'}
          </button>
          <Link href="/login" className="btn btn-outline">{t('login') || 'Log in'}</Link>
          <Link href="/register" className="btn btn-primary">{t('signup') || 'Sign up'}</Link>
        </div>
      </header>

      <main className={styles.hero}>
        <div className={styles['hero-content']}>
          <div className={styles.badge}>✨ {t('heroBadge') || 'Next-Gen Property Management'}</div>
          <h1 className={`${styles['hero-title']} ${language === 'th' ? styles['hero-title-th'] : ''}`}>
            {language === 'th' ? (
              <>
                <span className={styles.nowrap}>ระบบจัดการหอพัก</span> <br />
                แบบ<span className={styles.highlight}>ครบวงจร</span>
              </>
            ) : (
              <>
                Effortless Dormitory <br />
                <span className={styles.highlight}>Management</span> System
              </>
            )}
          </h1>
          <p className={styles['hero-description']}>
            {t('heroDesc') || 'Automate billing, track maintenance, and manage tenants seamlessly with our all-in-one modern platform designed for forward-thinking building owners.'}
          </p>
          <div className={styles['hero-buttons']}>
            <Link href="/dashboard" className="btn btn-primary btn-large">{t('goDashboard') || 'Go to Dashboard'}</Link>
            <Link href="#demo" className="btn btn-outline btn-large">{t('viewDemo') || 'View Demo'}</Link>
          </div>
        </div>

        <div className={styles['hero-visual']}>
          <div className={styles['glass-card']}>
            <div className={styles['mock-ui-header']}>
              <div className={styles['mock-ui-header-title']}>{t('mockRevenue') || 'Monthly Revenue Overview'}</div>
              <div className={styles['mock-ui-header-stat']}>+12.5%</div>
            </div>
            <div className={styles['mock-block']}></div>
            <div className={styles['mock-block']}></div>
            <div className={styles['mock-block']}></div>
            <div className={styles['mock-block']}></div>
            <div className={styles['mock-block']}></div>

            <div className={`${styles['floating-element']} ${styles['float-1']}`}>
              <div className={styles['stat-circle']}>✓</div>
              <div>
                <div className={styles['float-stat-label']}>{t('invoicesPaid') || 'Invoices Paid'}</div>
                <div className={styles['float-stat-value']}>$4,250.00</div>
              </div>
            </div>

            <div className={`${styles['floating-element']} ${styles['float-2']}`}>
              <div className={`${styles['stat-circle']} ${styles['stat-circle-warning']}`}>!</div>
              <div>
                <div className={styles['float-stat-label']}>{t('newRequest') || 'New Request'}</div>
                <div className={styles['float-stat-value']}>{t('room402') || 'Room 402 AC Fix'}</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}