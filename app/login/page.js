import { login } from '@/services/authActions'
import Link from 'next/link'
import '@/styles/auth.css'

export default async function LoginPage(props) {
    const searchParams = await props.searchParams
    const error = searchParams?.error
    const message = searchParams?.message

    return (
        <div className="auth-container">
            <div className="auth-card">
                <Link href="/" className="back-btn">
                    ← Back
                </Link>
                <h1 className="auth-title">Welcome Back</h1>
                <p className="auth-subtitle">Please enter your details to sign in.</p>

                {message && (
                    <div style={{ backgroundColor: '#ecfdf5', color: '#047857', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {message}
                    </div>
                )}
                
                {error && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <form className="auth-form" action={login}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            className="form-input"
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <input
                            className="form-input"
                            id="password"
                            name="password"
                            type="password"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button className="btn btn-primary auth-btn" type="submit">
                        Sign In
                    </button>
                </form>

                <div className="auth-link">
                    Don't have an account? <Link href="/register">Sign up</Link>
                </div>
            </div>
        </div>
    )
}
