// components/ThemeProvider.js
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useState, useEffect } from 'react'

export function ThemeProvider({ children, ...props }) {
  // แก้บัค Hydration mismatch ใน Next.js
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <>{children}</>
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}