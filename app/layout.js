import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";

import { ThemeProvider } from '@/contexts/ThemeProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// เปลี่ยน Title ให้ตรงกับโปรเจคหอพักของคุณสักหน่อย
export const metadata = {
  title: "HoPak - Dormitory Management",
  description: "ระบบจัดการหอพักครบวงจร",
};

// มี RootLayout แค่ตัวเดียวแล้ว!
export default function RootLayout({ children }) {
  return (
    // ใส่ suppressHydrationWarning ที่ html เพื่อไม่ให้ Next.js บ่นตอนสลับโหมดมืด/สว่าง
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        
        {/* ชั้นที่ 1: จัดการเรื่อง Theme (มืด/สว่าง) */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          
          {/* ชั้นที่ 2: จัดการเรื่องภาษา (ไทย/อังกฤษ) */}
          <LanguageProvider>
            
            {children}
            
          </LanguageProvider>
          
        </ThemeProvider>

      </body>
    </html>
  );
}