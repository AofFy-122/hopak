import { signup } from '@/services/authActions'
import Link from 'next/link'
import '@/styles/auth.css'

export default function RegisterPage() {
    return (
        <div className="auth-container">
            <div className="auth-card">
                <Link href="/" className="back-btn">
                    ← Back
                </Link>
                <h1 className="auth-title">Create Account</h1>
                <p className="auth-subtitle">Get started with Horganice today.</p>

                <form className="auth-form" action={signup}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="fullName">Full Name</label>
                        <input
                            className="form-input"
                            id="fullName"
                            name="fullName"
                            type="text"
                            placeholder="John Doe"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            className="form-input"
                            id="email"
                            name="email"
                            type="email"
                            placeholder="john@example.com"
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
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="role">Role</label>
                        <select className="form-select" id="role" name="role" required defaultValue="tenant">
                            <option value="tenant">Tenant</option>
                            <option value="owner">Building Owner</option>
                            <option value="staff">Staff Member</option>
                        </select>
                    </div>

                    <button className="btn btn-primary auth-btn" type="submit">
                        Create Account
                    </button>
                </form>

                <div className="auth-link">
                    Already have an account? <Link href="/login">Sign in</Link>
                </div>
            </div>
        </div>
    )
}
