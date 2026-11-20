import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Clock3, XCircle, RefreshCw, ShieldCheck, UserRound, CalendarDays, Inbox, LockKeyhole } from 'lucide-react';
import { api } from '../api';
import { Alert, formatDate, Loading, StatusBadge, useApp } from '../ui';
import { Field, PrivateImage } from '../components';

export function Login({ admin = false }) {
  const { user, refreshUser } = useApp();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api(admin ? '/admin/login' : '/auth/login', { method: 'POST', body: { [admin ? 'email' : 'phone']: identifier, password } });
      await refreshUser(); navigate(admin ? '/admin' : '/dashboard', { replace: true });
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  if (user?.role === (admin ? 'admin' : 'player')) return <Navigate to={admin ? '/admin' : '/dashboard'} replace />;
  return <section className="wrap login-layout page-space"><div className="login-intro"><p className="eyebrow">{admin ? 'ORGANISING COMMITTEE' : 'YOUR SEASON, AT A GLANCE'}</p><h1 className="page-title">{admin ? <>Behind every<br /><em>great game.</em></> : <>Back for your<br /><em>next innings?</em></>}</h1><p>{admin ? 'A simple workspace to review players, verify payments and keep every applicant informed.' : 'Your registration, verification status and tournament updates. All in one place.'}</p><div className="login-detail"><ShieldCheck size={26} /><p>{admin ? 'Only authorised organisers can review applications and access payment proofs.' : 'Use the mobile number and password you chose during registration.'}</p></div></div><div className="login-card"><span className="login-icon">{admin ? <ShieldCheck /> : <UserRound />}</span><h2>{admin ? 'Admin sign in' : 'Player sign in'}</h2><p>{admin ? 'Welcome back to the organising desk.' : 'Let’s check on your application.'}</p>{error && <Alert>{error}</Alert>}<form onSubmit={submit}><Field id={admin ? 'admin-email' : 'login-phone'} label={admin ? 'Email address' : 'Mobile number'} type={admin ? 'email' : 'tel'} value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="username" placeholder={admin ? 'organiser@example.com' : '10-digit Indian mobile number'} required /><Field id={admin ? 'admin-password' : 'login-password'} label="Password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required maxLength={128} /><button className="button full-width" disabled={busy}>{busy ? 'Signing in…' : admin ? 'Open admin panel' : 'View my registration'}</button></form><p className="login-bottom">{admin ? <Link to="/login">Player sign in</Link> : <>New to Season 2? <Link to="/register">Register as a player</Link></>}</p><p className="small-note">Forgot your password? Contact the tournament organisers for assistance.</p></div></section>;
}

export function Dashboard() {
  const { user, authLoading } = useApp();
  const [player, setPlayer] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  async function load() {
    setRefreshing(true);
    try { setPlayer(await api('/player/me')); setError(''); }
    catch (error) { setError(error.message); }
    finally { setRefreshing(false); }
  }
  useEffect(() => {
    if (user?.role !== 'player') return;
    load();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000);
    return () => clearInterval(interval);
  }, [user?.role]);
  async function markRead() {
    setMarking(true);
    try { await api('/player/notifications/read', { method: 'POST' }); await load(); }
    catch (error) { setError(error.message); }
    finally { setMarking(false); }
  }
  if (authLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  const unread = player?.notifications.filter(notification => !notification.readAt).length || 0;
  const approved = player?.status === 'approved';
  const rejected = player?.status === 'rejected';
  const StatusIcon = approved ? CheckCircle2 : rejected ? XCircle : Clock3;
  return <section className="wrap dashboard page-space"><div className="dashboard-heading"><div><p className="eyebrow">PLAYER DASHBOARD · SEASON 2</p><h1 className="page-title">Hello, <em>{player?.name?.split(' ')[0] || user.name?.split(' ')[0]}.</em></h1><p>Your application. Your updates. Your next innings.</p></div><button className="button button-secondary" onClick={load} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Refresh status</button></div>{error && <Alert>{error}</Alert>}{!player ? <Loading>Loading your registration…</Loading> : <>
    <div className={`status-hero ${player.status}`}><span className="status-hero-icon"><StatusIcon size={34} /></span><div><StatusBadge status={player.status} /><h2>{approved ? 'You’re verified. Get ready.' : rejected ? 'Your application needs attention.' : 'You’re registered. Review is next.'}</h2><p>{approved ? 'Congratulations! Your details and payment have been verified. We will inform you soon about the auction dates.' : rejected ? player.rejectionReason : 'Your player details and payment proof have reached the organising team. We’ll post the verification result right here.'}</p></div><span className="registration-id">{player.registrationId}</span></div>
    <div className="player-dashboard-grid"><div><div className="panel"><div className="panel-heading"><h2><UserRound size={20} /> Your player profile</h2><span className="secondary-meta">Submitted {formatDate(player.createdAt)}</span></div><div className="player-profile"><PrivateImage id={player.playerPhotoId} alt="Player photograph" className="profile-photo" /><dl className="detail-grid"><div><dt>Full name</dt><dd>{player.name}</dd></div><div><dt>Mobile number</dt><dd>{player.phone}</dd></div><div><dt>Age</dt><dd>{player.age} years</dd></div><div><dt>Playing role</dt><dd>{player.roles.join(', ')}</dd></div><div><dt>T-shirt size</dt><dd>{player.tshirtSize}</dd></div><div><dt>Registration fee</dt><dd>₹{player.paymentAmount}</dd></div><div className="span-2"><dt>Address</dt><dd>{player.address}</dd></div><div className="span-2"><dt>Payment transaction reference</dt><dd>{player.transactionReference}</dd></div></dl></div></div><div className="panel journey-panel"><h2><CalendarDays size={20} /> Your journey to the field</h2><div className="journey"><div className="done"><CheckCircle2 size={22} /><span><strong>Application submitted</strong><small>Your registration and payment proof were received.</small></span></div><div className={approved ? 'done' : rejected ? 'failed' : 'current'}><StatusIcon size={22} /><span><strong>{approved ? 'Details & payment verified' : rejected ? 'Application rejected' : 'Verification in progress'}</strong><small>{player.reviewedAt ? formatDate(player.reviewedAt) : 'The organising team will review your application.'}</small></span></div><div><CalendarDays size={22} /><span><strong>Auction announcement</strong><small>{rejected ? 'Participation is subject to approval by the organisers.' : 'Dates will be announced by the organisers.'}</small></span></div></div></div></div>
    <aside className="panel notifications-panel"><div className="panel-heading"><h2><Bell size={20} /> Notifications {unread > 0 && <span className="notification-count">{unread}</span>}</h2>{unread > 0 && <button className="inline-button" onClick={markRead} disabled={marking}>{marking ? 'Saving…' : 'Mark all read'}</button>}</div><p className="small-note">Updates appear here when the organising team reviews your registration. This page refreshes automatically while open.</p><div className="notification-list">{[...player.notifications].reverse().map(notification => <article key={notification._id} className={`notification ${notification.readAt ? '' : 'unread'}`}><span className={`notification-icon ${notification.kind}`}>{notification.kind === 'approved' ? <CheckCircle2 size={19} /> : notification.kind === 'rejected' ? <XCircle size={19} /> : <Inbox size={19} />}</span><div><strong>{notification.kind === 'approved' ? 'Registration approved' : notification.kind === 'rejected' ? 'Registration rejected' : 'Application received'}</strong><p>{notification.message}</p><time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time></div></article>)}</div></aside></div>
  </>}</section>;
}
