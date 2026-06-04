import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Landing() {
    const { user } = useAuth();

    if (user) {
        return <Navigate to="/files" />;
    }

    return (
        <div className="landing-body">
            {/* Nav */}
            <nav className="landing-nav">
                <div className="landing-nav-inner">
                    <div className="landing-logo">
                        <span className="landing-logo-icon">☁️</span>
                        <span className="landing-logo-name">CloudVault</span>
                    </div>
                    <div className="landing-nav-actions">
                        <Link to="/login" className="nav-link">Sign In</Link>
                        <Link to="/register" className="nav-btn-primary">Get Started Free</Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="landing-hero">
                <div className="landing-hero-inner">
                    <div className="hero-badge">✨ Simple &amp; Secure Cloud Storage</div>
                    <h1 className="hero-title">Your files,<br /><span className="hero-title-accent">anywhere you go</span></h1>
                    <p className="hero-sub">Upload files and folders in seconds. Access them from any device, any time. Your data is isolated to your account — no one else can see it.</p>
                    <div className="hero-ctas">
                        <Link to="/register" className="cta-btn-primary">Create a free account</Link>
                        <Link to="/login" className="cta-btn-secondary">Sign in</Link>
                    </div>
                    <p className="hero-note">No credit card required · Free forever for personal use</p>
                </div>
                <div className="hero-blob"></div>
                <div className="hero-blob hero-blob-2"></div>
            </section>

            {/* Features */}
            <section className="landing-features">
                <div className="landing-section-inner">
                    <h2 className="section-title">Everything you need to stay organized</h2>
                    <p className="section-sub">A clean, fast file manager that gets out of your way.</p>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">🔒</div>
                            <h3 className="feature-title">Per-user isolation</h3>
                            <p className="feature-desc">Every account has its own private space. Your files are never mixed with other users' data.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">📂</div>
                            <h3 className="feature-title">Folder support</h3>
                            <p className="feature-desc">Upload entire folder trees in one go. Browse, navigate, and organize just like your desktop.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">⚡</div>
                            <h3 className="feature-title">Drag &amp; drop uploads</h3>
                            <p className="feature-desc">Drop files directly onto the page. Stage multiple items, review them, then upload with one click.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🔍</div>
                            <h3 className="feature-title">Instant search</h3>
                            <p className="feature-desc">Find any file instantly with live search. No page reloads — results update as you type.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">📦</div>
                            <h3 className="feature-title">Batch download</h3>
                            <p className="feature-desc">Select multiple files and download them in a single ZIP archive, right from your browser.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🗂️</div>
                            <h3 className="feature-title">Grid &amp; list views</h3>
                            <p className="feature-desc">Switch between a visual grid and a detailed list view. Sort by name, date, or size.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="landing-cta-banner">
                <div className="landing-section-inner cta-banner-inner">
                    <h2 className="cta-banner-title">Ready to get started?</h2>
                    <p className="cta-banner-sub">Create your account in under 30 seconds.</p>
                    <Link to="/register" className="cta-btn-primary cta-banner-btn">Sign up — it's free</Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="landing-section-inner footer-inner">
                    <div className="footer-logo">
                        <span>☁️</span> CloudVault
                    </div>
                    <div className="footer-links">
                        <Link to="/login">Sign In</Link>
                        <Link to="/register">Register</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
