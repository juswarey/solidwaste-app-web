// Public home page with the admin sign-in window (port of index.php + header.php + footer.php).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { SITE_NAME } from '../config';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return {
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Manila' }),
    date: now.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' }),
  };
}

function LoginModal({ open, onClose, initialError = '' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('barangay');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (initialError) setError(initialError); }, [initialError]);
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await auth.signIn(email, password, role);
      navigate(`/${r}/dashboard`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className={`modal-overlay${open ? ' active' : ''}`} aria-hidden={!open} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-container" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
        <button className="modal-close" aria-label="Close" onClick={onClose}>&times;</button>
        <div className="modal-tabs"><span className="modal-tab active" id="loginTitle">Admin sign in</span></div>
        <div className="modal-body">
          <form className="auth-form active" onSubmit={submit}>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="form-group">
              <label htmlFor="login-role">Account type</label>
              <select id="login-role" className="form-control" value={role} onChange={(e) => setRole(e.target.value)} required>
                <option value="barangay">Barangay Admin</option>
                <option value="lgu">LGU Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="login-email">Email address</label>
              <input type="email" id="login-email" className="form-control" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input type="password" id="login-password" className="form-control" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <p style={{ marginTop: '1rem', fontSize: '.85rem', textAlign: 'center' }}>
              Residents and garbage collectors: please use the ECollect mobile app to sign in, register, view schedules and send reports.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const auth = useAuth();
  const navigate = useNavigate();
  const clock = useClock();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [expired, setExpired] = useState('');
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('ecollect-expired')) {
        sessionStorage.removeItem('ecollect-expired');
        setExpired('You were signed out after 30 minutes without activity. Please sign in again.');
        setOpen(true);
      }
    } catch { /* ignore */ }
    const onScroll = () => setScrolled(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ecollect-theme', next); } catch { /* ignore */ }
    setTheme(next);
  };
  const openLogin = (e) => {
    e?.preventDefault();
    if (auth.signedIn && auth.activeRole) { navigate(`/${auth.activeRole}/dashboard`); return; }
    setOpen(true);
  };
  const year = new Date().getFullYear();

  return (
    <div className="landing">
      <header className="site-header" id="header">
        <div className="header-container container">
          <a href="#home" className="logo">
            <div className="header-logos">
              <img src="/images/iligan.jpg" alt="Iligan City Official Seal" className="city-logo" />
              <img src="/images/lgu_iligan.jpg" alt="LGU Iligan Logo" className="city-logo" />
              <img src="/images/poblogo.png" alt="Barangay Poblacion Seal" className="city-logo" />
            </div>
            <div className="logo-text"><span className="brand-name">{SITE_NAME}</span><span className="brand-sub">Barangay Poblacion Waste System</span></div>
          </a>
          <nav className={`main-nav${menu ? ' active' : ''}`} aria-label="Main Navigation">
            <ul className="nav-list">
              {[['home', 'Home'], ['about', 'About'], ['services', 'Services'], ['contact', 'Contact']].map(([id, l]) => (
                <li key={id}><a href={`#${id}`} className="nav-link" onClick={() => setMenu(false)}>{l}</a></li>
              ))}
            </ul>
          </nav>
          <div className="header-actions">
            <div className="topbar-clock-wrap"><span className="digital-clock">{clock.time}</span><span className="header-date">{clock.date}</span></div>
            <button className="btn-icon" aria-label="Toggle dark mode" onClick={toggleTheme}>
              {theme === 'dark'
                ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>}
            </button>
            <a href="#" className="btn btn-primary btn-sm" onClick={openLogin}>{auth.signedIn && auth.activeRole ? 'Open dashboard' : 'Login'}</a>
            <button className={`hamburger-menu${menu ? ' active' : ''}`} aria-label="Toggle menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              <span className="bar" /><span className="bar" /><span className="bar" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section id="home" className="hero-section">
          <div className="container hero-container">
            <div className="hero-content">
              <span className="badge">Eco-Friendly & Intelligent</span>
              <h1 className="hero-title">Solid Waste Collection Scheduling</h1>
              <p className="hero-subtitle">Streamlining city waste pickup and recycling for healthier communities. Schedule pickups on demand, monitor real-time routes, and keep your neighborhood green.</p>
              <div className="hero-actions"><a href="#" className="btn btn-primary btn-lg" onClick={openLogin}>Get Started</a></div>
            </div>
            <div className="hero-image-wrapper">
              <div className="hero-card-glass">
                <div className="svg-hero-illustration">
                  <svg viewBox="0 0 500 400" width="100%" height="100%" aria-hidden="true">
                    <defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2E7D32" /><stop offset="100%" stopColor="#1976D2" /></linearGradient></defs>
                    <circle cx="250" cy="200" r="160" fill="url(#grad1)" opacity="0.15" />
                    <rect x="120" y="140" width="260" height="180" rx="16" fill="#FFFFFF" />
                    <rect x="140" y="160" width="220" height="20" rx="6" fill="#E8F5E9" />
                    <rect x="140" y="195" width="160" height="14" rx="4" fill="#E0E0E0" />
                    <rect x="140" y="220" width="180" height="14" rx="4" fill="#E0E0E0" />
                    <circle cx="330" cy="265" r="30" fill="#2E7D32" />
                    <path d="M320 265 l8 8 l16 -16" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="about-section section-padding">
          <div className="container">
            <div className="section-header text-center"><h2>Organized Collection For Better Living</h2><p>We combine technology and operational logistics to minimize environmental impact and maximize recycling rates.</p></div>
            <div className="about-grid">
              <div className="about-card"><div className="about-icon"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg></div>
                <h3>For Residents</h3><p>Never miss a pickup day again. Track trucks live in your neighborhood, log bulky item requests, and view recycling guidelines.</p></div>
              <div className="about-card"><div className="about-icon"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg></div>
                <h3>For Waste Collectors</h3><p>Dynamic route optimization reduces fuel consumption and minimizes delays, improving overall team efficiency and safety.</p></div>
              <div className="about-card"><div className="about-icon"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg></div>
                <h3>Environmental Impact</h3><p>Structured scheduled collection prevents landfill overflow, mitigates illegal dumping, and encourages active urban sorting.</p></div>
            </div>
          </div>
        </section>

        <section id="services" className="features-section section-padding bg-light">
          <div className="container">
            <div className="section-header text-center"><h2>Smart Tools For Smarter Cities</h2></div>
            <div className="features-grid">
              {[['📅', 'Online Scheduling', 'Book special bulk waste or hazardous material pickups directly from your smartphone or desktop.'],
                ['🗺️', 'Collection Calendar', 'Interactive calendar categorized by organic, recyclable, and general household waste types.'],
                ['📍', 'Real-Time Truck Tracking', 'Monitor live GPS locations of collection trucks in your zone so you know exactly when to place your bins out.'],
                ['🚚', 'Route Management', 'Optimized driver navigation pathways ensure timely servicing and reduced carbon emissions across municipal sectors.'],
                ['📊', 'Waste Reports', 'Access municipal data and personal household metrics to track monthly recycling efficiency over time.'],
                ['⚙️', 'Admin Dashboard', 'Centralized dispatch system for municipal managers to assign routes and handle citizen requests.']].map(([i, h, t]) => (
                <div className="feature-card" key={h}><div className="feature-icon">{i}</div><h3>{h}</h3><p>{t}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="how-it-works section-padding">
          <div className="container">
            <div className="section-header text-center"><h2>How It Works</h2></div>
            <div className="steps-wrapper">
              {[['👤', 'Register Account', 'Register in the ECollect mobile app with your address and contact number, then choose your zone.'],
                ['📆', 'Schedule Pickup', 'Select your preferred dates or view fixed recurring collection windows.'],
                ['📍', 'Track Truck Live', 'Follow the collection truck’s arrival progress on an interactive live map in real time.'],
                ['♻️', 'Collection Done', 'Place bins out as the truck approaches. Our automated crew handles prompt, clean collection.']].map(([i, h, t], n) => (
                <div className="step-card" key={h}><div className="step-number">{n + 1}</div><div className="step-icon">{i}</div><h3>{h}</h3><p>{t}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="stats-section section-padding">
          <div className="container text-center">
            <h2 className="stats-title">Building a Cleaner Iligan City Together</h2>
            <p className="stats-description">Our digital waste scheduling system is officially live! As residents, barangay officials, and collection crews register across Iligan City, real-time statistics and analytics will populate here.</p>
          </div>
        </section>

        <section className="testimonials-section section-padding">
          <div className="container">
            <div className="section-header text-center"><h2>What Our Residents Say</h2><p>Community feedback and reviews will be featured here as Iligan residents use the system.</p></div>
            <div className="empty-state-card"><div className="empty-state-icon">💬</div><h3>Be One of Our First Reviewers</h3>
              <p>We are just getting started! Once collection services begin in your area, you'll be able to rate your service and share feedback to help us keep Iligan City clean and sustainable.</p></div>
          </div>
        </section>

        <section id="contact" className="location-contact-section section-padding">
          <div className="container">
            <div className="section-header text-center"><h2>Our Service Area</h2><p>Find us in Barangay Poblacion, Iligan City and get in touch with our support team for questions about waste collection services.</p></div>
            <div className="location-contact-grid">
              <div className="map-card">
                <iframe title="Poblacion Barangay Hall on Google Maps" width="100%" height="450" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d987.1840961705204!2d124.23391334638909!3d8.229242766848605!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x325575e7ac009721%3A0x5dd0875c959538f4!2sPoblacion%20Barangay%20Hall!5e0!3m2!1sen!2sph!4v1790219344394!5m2!1sen!2sph" />
              </div>
              <div className="contact-card">
                <span className="contact-label">GET IN TOUCH</span>
                <h3>Need Help?</h3>
                <p className="contact-description">Have questions about waste collection schedules, reports, or other services? Our team is here to help.</p>
                <div className="contact-info">
                  <div className="contact-item"><div className="contact-icon">📍</div><div><span>Location</span><p>Barangay Poblacion<br />Iligan City, Philippines</p></div></div>
                  <div className="contact-item"><div className="contact-icon">📧</div><div><span>Email</span><p>support@solidwaste.local</p></div></div>
                  <div className="contact-item"><div className="contact-icon">📞</div><div><span>Contact</span><p>Contact your Barangay Office</p></div></div>
                </div>
                <a href="#" className="btn btn-primary" onClick={openLogin}>Get Started</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-container">
          <div className="footer-col footer-brand-col">
            <a href="#home" className="logo logo-footer"><span className="brand-name">{SITE_NAME}</span></a>
            <p className="footer-desc">Providing sustainable waste management logistics and modern scheduling solutions to build cleaner, smarter communities.</p>
          </div>
          <div className="footer-col"><h4 className="footer-title">Quick Links</h4>
            <ul className="footer-links"><li><a href="#home">Home</a></li><li><a href="#about">About Us</a></li><li><a href="#services">Services</a></li><li><a href="#contact">Contact</a></li></ul></div>
          <div className="footer-col"><h4 className="footer-title">Contact Us</h4>
            <address className="footer-contact-info"><p>📍 Poblacion, Iligan City</p><p>📞 09358158491</p><p>✉️ juswarey@gmail.com</p><p>⏰ Mon - Fri: 8:00 AM - 5:00 PM</p></address></div>
        </div>
        <div className="footer-bottom text-center"><div className="container"><p>&copy; {year} {SITE_NAME} Iligan City Waste System. All rights reserved.</p></div></div>
      </footer>
      <button className={`back-to-top${scrolled ? ' visible show' : ''}`} aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
      <LoginModal open={open} onClose={() => setOpen(false)} initialError={expired} />
    </div>
  );
}
