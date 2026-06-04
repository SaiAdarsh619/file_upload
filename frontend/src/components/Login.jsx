import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const searchParams = new URLSearchParams(location.search);
    const registered = searchParams.get('registered') === '1';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                login(data.user);
                navigate('/files');
            } else {
                setError(data.error || 'Login failed.');
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

                    {registered && <div className="auth-success">Account created! Please log in.</div>}
                    {error && <div className="auth-error">{error}</div>}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                autoComplete="username"
                                required
                                autoFocus
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                autoComplete="current-password"
                                required
                            />
                        </div>
                        <button type="submit" className="auth-btn">Sign In</button>
                    </form>

                    <p className="auth-switch">
                        Don't have an account? <Link to="/register">Register</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
