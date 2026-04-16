import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({ children }) {
    const supabase = await createClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        redirect('/login')
    }

    return (
        <div className="layout-container">
            <Sidebar />
            <main className="main-content">
                <Header user={user} />
                <div className="page-content">
                    {children}
                </div>
            </main>
        </div>
    )
}
