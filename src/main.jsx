import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Menu, X, LogOut, Trophy, MapPin, Sun, Moon, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { api, fallbackConfig } from './api';
import { AppContext, Loading, useApp } from './ui';
import './styles.css';
import './app.css';

const Register = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const Login = lazy(() => import('./pages/Player').then(module => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Player').then(module => ({ default: module.Dashboard })));
const AdminPanel = lazy(() => import('./pages/Admin').then(module => ({ default: module.AdminPanel })));

function Header() {
  const { user, logout } = useApp();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [location.pathname]);
  return <header className="header wrap"><Link className="brand" to="/"><span className="brand-icon" aria-hidden="true">U<span>G</span>M</span><span>URMILA GUPTA MEMORIAL<small>CRICKET TOURNAMENT · SEASON 2</small></span></Link><nav className={menu ? 'nav-open' : ''} aria-label="Main navigation"><Link to="/">The tournament</Link><Link to={user?.role === 'admin' ? '/admin' : '/dashboard'}>{user?.role === 'admin' ? 'Admin panel' : 'Track registration'}</Link>{user ? <button className="nav-logout" onClick={logout}><LogOut size={16} /> Sign out</button> : <Link to="/login">Player sign in</Link>}</nav><Link className="button button-small header-cta" to="/register">Player registration</Link><button className="icon-button mobile-menu" onClick={() => setMenu(v => !v)} aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu}>{menu ? <X /> : <Menu />}</button></header>;
}
function Footer() {
  return <footer className="wrap"><Link className="brand footer-brand" to="/"><span className="brand-icon" aria-hidden="true">U<span>G</span>M</span><span>URMILA GUPTA MEMORIAL<small>CRICKET TOURNAMENT · SEASON 2</small></span></Link><p>Tenughat Golden Jubilee Ground<br />Day matches. Night final.</p><div><Link className="footer-link" to="/admin">Organiser sign in</Link><p className="credit">Sample stadium image: <a href="https://www.wisden.com/series/icc-mens-cricket-world-cup-2023-24/cricket-news/cwc23-venue-guide-all-you-need-to-know-about-the-10-world-cup-venues-capacity-dimensions-spin-vs-pace-records" target="_blank" rel="noreferrer">Wisden</a></p></div></footer>;
}
function Home() {
  const { config } = useApp();
  return <>
    <section className="hero wrap"><div className="hero-copy"><p className="eyebrow"><span className="line" />TENUGHAT’S NEXT CRICKET CHAPTER</p><h1>FOR THE LOVE<br />OF THE <em>GAME.</em></h1><h2>Urmila Gupta Memorial<br />Cricket Tournament <span>Season 2</span></h2><p className="hero-description">Bring your game to Tenughat Golden Jubilee Ground. Play through the day. Chase the trophy under the lights.</p><div className="hero-actions"><Link className="button" to="/register">Register as a player</Link><Link className="text-link" to="/dashboard">Track your registration</Link></div><p className="registration-status">{config.registration.message}</p></div><div className="hero-visual"><img src="/assets/night-stadium.jpg" alt="A cricket stadium illuminated by floodlights at night" fetchPriority="high" /><div className="season-stamp">SEASON<strong>02</strong></div><div className="image-caption"><span>THE ROAD TO THE FINAL</span><strong>Daytime battles.<br />A night to remember.</strong><p>Day matches · Final under lights</p></div><span className="sample-label">Representative stadium image</span></div></section>
    <div className="ticker"><div>ONE GROUND. <span>ONE GAME.</span> ONE UNFORGETTABLE FINAL. <span className="star">✦</span> SEASON 2 <span className="star">✦</span> TENUGHAT</div></div>
    <section className="tournament-section wrap"><div className="section-heading"><div><p className="eyebrow">THE TOURNAMENT</p><h2>Your ground.<br />Your moment.</h2></div><p>Everything you need to know before you step up and register.</p></div><div className="facts"><article><span className="fact-label">PLAYER REGISTRATION</span><strong>₹150<span> / player</span></strong><p>Pay via UPI and upload your payment screenshot for verification.</p></article><article><span className="fact-label">REGISTRATION WINDOW</span><strong>24 Nov <span>–</span> 20 Dec</strong><p>2026 · Submit your completed application by 20 December.</p></article><article><span className="fact-label">THE VENUE</span><strong>Tenughat</strong><p>Golden Jubilee Ground</p><a className="text-link" href="https://www.google.com/maps/search/?api=1&query=Tenughat%20Golden%20Jubilee%20Ground" target="_blank" rel="noreferrer">Find the ground on Maps</a></article></div><div className="format-note"><Sun className="sun" size={30} /><div><strong>Day matches. Night final.</strong><p>Tournament matches will be played during the day. The final will be held at night. Match dates and auction details will be announced by the organisers.</p></div><span className="night-tag"><Moon size={14} /> FINALE UNDER LIGHTS</span></div></section>
    <section className="steps-section"><div className="wrap"><div className="section-heading"><div><p className="eyebrow">FROM FORM TO FIELD</p><h2>One application.<br />Your next innings.</h2></div><p>Register, pay and keep track.<br />We’ll take it from there.</p></div><div className="steps"><article><Trophy className="step-icon" /><h3>Build your player profile</h3><p>Tell us your name, age, playing role and T-shirt size. Add your mobile number and a clear photograph.</p></article><article><ShieldCheck className="step-icon" /><h3>Pay & submit for review</h3><p>Scan the ₹150 UPI QR, complete your payment and upload the screenshot. Your application starts as pending.</p></article><article><MapPin className="step-icon" /><h3>Follow your application</h3><p>Sign in to see approval or rejection updates in your notification inbox. Auction dates will be announced separately.</p></article></div><p className="hindi-note" lang="hi">अपनी जानकारी भरें, ₹150 का भुगतान करें और पेमेंट स्क्रीनशॉट अपलोड करें। आवेदन की स्थिति अपने डैशबोर्ड पर देखें।</p></div></section>
    <section className="faq-section wrap home-faq"><div><p className="eyebrow">BEFORE YOU APPLY</p><h2>A few good<br />questions.</h2></div><div className="faq-list"><details open><summary>What do I need to register?</summary><p>Your personal details, Indian mobile number, a player photograph, playing role, T-shirt size and a screenshot of your ₹150 payment. Create a password so you can track your registration.</p></details><details><summary>Who receives the registration payment?</summary><p>Pay ₹150 to Anubhav Jha at 8210708838sbi@axl. Always check the payee details displayed in your UPI app before paying. The current payment QR is shown during registration.</p></details><details><summary>Does payment confirm my participation?</summary><p>Your application remains pending until the organisers verify your details and payment. Approval or rejection, including a rejection reason, will appear in your player dashboard.</p></details><details><summary>Will I receive an SMS or WhatsApp message?</summary><p>Updates are currently available inside your player dashboard only. Sign in to check your application status and notification inbox.</p></details></div></section>
    <section className="final-call wrap"><p className="eyebrow">URMILA GUPTA MEMORIAL · SEASON 2</p><h2>Make this season<br /><em>your season.</em></h2><Link className="button" to="/register">Start your registration</Link><p>24 November – 20 December 2026 · ₹150 per player</p></section>
  </>;
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [config, setConfig] = useState(fallbackConfig);
  const [configError, setConfigError] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  async function refreshConfig() {
    setConfigLoading(true);
    try { setConfig(await api('/config')); setConfigError(''); }
    catch (error) { setConfigError(error.message); }
    finally { setConfigLoading(false); }
  }
  async function refreshUser() {
    try { const next = await api('/auth/me'); setUser(next); return next; }
    catch { setUser(null); return null; }
    finally { setAuthLoading(false); }
  }
  async function logout() { await api('/auth/logout').catch(() => {}); setUser(null); }
  useEffect(() => { refreshConfig(); refreshUser(); }, []);
  return <AppContext.Provider value={{ user, setUser, authLoading, refreshUser, logout, config, configError, configLoading, refreshConfig }}><HashRouter><a className="skip" href="#main">Skip to content</a><Header /><main id="main"><Suspense fallback={<Loading />}><Routes><Route path="/" element={<Home />} /><Route path="/register" element={<Register />} /><Route path="/login" element={<Login />} /><Route path="/dashboard" element={<Dashboard />} /><Route path="/admin" element={<AdminPanel />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></Suspense></main><Footer /></HashRouter></AppContext.Provider>;
}

createRoot(document.getElementById('root')).render(<App />);
