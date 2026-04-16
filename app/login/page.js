import { login } from '@/services/authActions'
import Link from 'next/link'
import '@/styles/auth.css'

export default function LoginPage() {
    return (
        <div className="auth-container">
            <div className="auth-card">
                <Link href="/" className="back-btn">
                    ← Back
                </Link>
                <h1 className="auth-title">Welcome Back</h1>
                <p className="auth-subtitle">Please enter your details to sign in.</p>

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
