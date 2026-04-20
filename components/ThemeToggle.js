// components/ThemeToggle.js
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // รอให้โหลดเสร็จก่อนเพื่อป้องกัน UI กระตุก
    useEffect(() => setMounted(true), [])
    if (!mounted) return null

    return (
        <button 
            className="btn btn-outline"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ marginLeft: '8px' }}
        >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
    )
}