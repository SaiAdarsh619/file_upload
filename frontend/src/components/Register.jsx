import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, confirm })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                navigate('/login?registered=1');
            } else {
                setError(data.error || 'Registration failed.');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        }
    };

    return (
        <div className="auth-body">
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <span className="auth-logo-icon">☁️</span>
                        <h1 className="auth-title">CloudVault</h1>
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="3–32 chars, letters/numbers/_.-"
                                autoComplete="username"
                                required
                                autoFocus
                                minLength="3"
                                maxLength="32"
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                autoComplete="new-password"
                                required
                                minLength="6"
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="confirm">Confirm Password</label>
                            <input
                                type="password"
                                id="confirm"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Repeat password"
                                autoComplete="new-password"
                                required
                                minLength="6"
                            />
                        </div>
                        <button type="submit" className="auth-btn">Create Account</button>
                    </form>

                    <p className="auth-switch">
                        Already have an account? <Link to="/login">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
