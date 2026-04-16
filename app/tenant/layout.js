import TenantSidebar from '@/components/layout/TenantSidebar'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function TenantLayout({ children }) {
    const supabase = await createClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        redirect('/login')
    }

    // Verify role to ensure only tenants can access this layout
    const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (userData?.role !== 'tenant') {
        redirect('/dashboard') // redirect non-tenants back to main dashboard
    }

    return (
        <div className="layout-container">
            <TenantSidebar />
            <main className="main-content">
                <Header user={user} />
                <div className="page-content">
                    {children}
                </div>
            </main>
        </div>
    )
}
