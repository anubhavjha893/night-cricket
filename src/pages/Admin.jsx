import React, { useEffect, useState } from 'react';
import { Users, Clock3, CheckCircle2, XCircle, Search, Settings2, ListFilter, X, RefreshCw, Check, ShieldCheck, Save, QrCode } from 'lucide-react';
import { api, API_BASE } from '../api';
import { Alert, formatDate, Loading, StatusBadge, useApp } from '../ui';
import { Field, FileUpload, PrivateImage } from '../components';
import { Login } from './Player';

export function AdminPanel() {
  const { user, authLoading } = useApp();
  const [tab, setTab] = useState('players');
  if (authLoading) return <Loading />;
  if (user?.role !== 'admin') return <Login admin />;
  return <section className="wrap admin-page page-space"><div className="dashboard-heading"><div><p className="eyebrow">ORGANISING DESK · SEASON 2</p><h1 className="page-title">The player <em>line-up.</em></h1><p>Review the details. Verify the payment. Make the call.</p></div><span className="admin-identity"><ShieldCheck size={17} /> {user.email}</span></div><div className="admin-tabs"><button className={tab === 'players' ? 'active' : ''} onClick={() => setTab('players')}><Users size={18} /> Player registrations</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}><Settings2 size={18} /> Payment & settings</button></div>{tab === 'players' ? <Players /> : <AdminSettings />}</section>;
}

function Players() {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ status, search, page: String(page) });
        setResult(await api(`/admin/players?${query}`, { signal: controller.signal })); setError('');
      } catch (error) { if (error.name !== 'AbortError') setError(error.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [status, search, page, refreshKey]);
  const counts = result?.counts || {};
  return <><div className="admin-stats">{[{ label: 'Total players', number: Object.values(counts).reduce((a, b) => a + b, 0), icon: Users, type: 'all' }, { label: 'Pending review', number: counts.pending || 0, icon: Clock3, type: 'pending' }, { label: 'Approved', number: counts.approved || 0, icon: CheckCircle2, type: 'approved' }, { label: 'Rejected', number: counts.rejected || 0, icon: XCircle, type: 'rejected' }].map(item => <button className={`stat-card ${item.type}`} onClick={() => { setStatus(item.type === 'all' ? '' : item.type); setPage(1); }} key={item.type}><item.icon size={22} /><span>{item.label}</span><strong>{item.number}</strong></button>)}</div>{error && <Alert>{error}</Alert>}<div className={`admin-workspace ${selected ? 'has-selection' : ''}`}><div className="panel player-list-panel"><div className="list-toolbar"><div className="search-field"><Search size={18} /><input type="search" aria-label="Search players" placeholder="Search name, phone or registration ID" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div><select aria-label="Filter registrations by status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All players</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button className="icon-button" aria-label="Refresh player list" onClick={() => setRefreshKey(value => value + 1)}><RefreshCw size={18} /></button></div><div className="list-caption"><span>PLAYERS · SORTED BY NAME</span><span>{result?.total || 0} results</span></div>{loading ? <Loading>Loading players…</Loading> : result?.players.length ? <div className="player-list">{result.players.map(player => <button className={`player-row ${selected === player._id ? 'selected' : ''}`} onClick={() => setSelected(player._id)} key={player._id}><span className="player-avatar">{player.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</span><span className="player-row-name"><strong>{player.name}</strong><small>{player.phone} · {player.roles.join(' / ')}</small><small className="registration-ref">{player.registrationId}</small></span><StatusBadge status={player.status} /></button>)}</div> : <div className="empty-state"><Users size={36} /><h3>No players found</h3><p>{search ? 'Try a different name or mobile number.' : 'Applications matching this filter will appear here.'}</p></div>}<div className="pagination"><span>Page {page} of {Math.max(1, result?.pages || 1)}</span><div><button className="button button-secondary button-small" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Previous</button><button className="button button-secondary button-small" disabled={page >= (result?.pages || 1) || loading} onClick={() => setPage(value => value + 1)}>Next</button></div></div></div>{selected ? <PlayerReview id={selected} onClose={() => setSelected('')} onDecision={() => setRefreshKey(value => value + 1)} /> : <div className="panel select-player"><ShieldCheck size={42} /><h2>A fair review starts here.</h2><p>Select a player to see their full application, photograph and payment proof.</p></div>}</div></>;
}

function PlayerReview({ id, onClose, onDecision }) {
  const [player, setPlayer] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verified, setVerified] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() { setPlayer(await api(`/admin/players/${id}`)); }
  useEffect(() => {
    let active = true; setPlayer(null); setError(''); setSuccess(''); setVerified(false); setRejecting(false); setReason('');
    api(`/admin/players/${id}`).then(result => { if (active) setPlayer(result); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [id]);
  async function decide(status) {
    if (status === 'approved' && !verified) return;
    if (status === 'rejected' && reason.trim().length < 5) { setError('Please give a clear rejection reason of at least 5 characters.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const result = await api(`/admin/players/${id}/decision`, { method: 'PATCH', body: { status, reason } });
      await load(); setSuccess(result.message); onDecision();
    } catch (error) { setError(error.message); if (error.status === 409) { await load(); onDecision(); } }
    finally { setBusy(false); }
  }
  return <section className="panel review-panel" aria-label="Player application details"><div className="panel-heading"><h2>Player application</h2><button className="icon-button" aria-label="Close player details" onClick={onClose}><X size={20} /></button></div>{error && <Alert>{error}</Alert>}{success && <Alert tone="success">{success}</Alert>}{!player ? !error && <Loading>Loading application…</Loading> : <><div className="review-player-heading"><PrivateImage id={player.playerPhotoId} alt={`${player.name} player photograph`} className="review-photo" /><div><StatusBadge status={player.status} /><h3>{player.name}</h3><p>{player.registrationId}</p></div></div><dl className="detail-grid"><div><dt>Mobile number</dt><dd><a href={`tel:+91${player.phone}`}>{player.phone}</a></dd></div><div><dt>Age</dt><dd>{player.age} years</dd></div><div><dt>Playing role</dt><dd>{player.roles.join(', ')}</dd></div><div><dt>T-shirt size</dt><dd>{player.tshirtSize}</dd></div><div className="span-2"><dt>Full address</dt><dd>{player.address}</dd></div><div className="span-2"><dt>Submitted</dt><dd>{formatDate(player.createdAt)}</dd></div></dl><div className="payment-review"><h3>Payment verification <strong>₹{player.paymentAmount}</strong></h3><p className="small-note">Transaction reference: <strong>{player.transactionReference}</strong></p><PrivateImage id={player.paymentProofId} alt={`${player.name} payment screenshot`} className="payment-proof" /><p className="small-note">Click the screenshot to view it at full size. Check the actual credit in the payment account before approval.</p></div>{player.status === 'pending' ? <div className="decision-box"><label className="checkbox-line"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} /><span>I have verified the player details and confirmed receipt of the ₹150 payment.</span></label>{rejecting && <Field id="rejection-reason" label="Reason for rejection" required><textarea id="rejection-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain clearly what could not be verified. This message will be sent to the player’s in-app inbox." rows={4} minLength={5} maxLength={1000} /></Field>}<div className="decision-actions">{rejecting ? <><button className="button button-secondary" disabled={busy} onClick={() => setRejecting(false)}>Cancel</button><button className="button button-danger" disabled={busy || reason.trim().length < 5} onClick={() => decide('rejected')}>{busy ? 'Saving…' : 'Confirm rejection'}</button></> : <><button className="button button-danger-outline" disabled={busy} onClick={() => setRejecting(true)}>Reject</button><button className="button button-success" disabled={!verified || busy} onClick={() => decide('approved')}><Check size={17} />{busy ? 'Saving…' : 'Approve registration'}</button></>}</div><p className="small-note">The player’s status and in-app notification update as soon as you save the decision.</p></div> : <div className="reviewed-note"><ShieldCheck size={21} /><div><strong>Reviewed {formatDate(player.reviewedAt)}</strong><p>{player.status === 'rejected' ? player.rejectionReason : 'Player details and payment approved. The player has been notified in the app.'}</p></div></div>}</>}</section>;
}

function AdminSettings() {
  const { refreshConfig } = useApp();
  const [settings, setSettings] = useState(null);
  const [qr, setQr] = useState(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/admin/settings').then(setSettings).catch(error => setError(error.message)); }, []);
  const set = key => event => setSettings(previous => ({ ...previous, [key]: event.target.value }));
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const body = new FormData();
      ['payeeName', 'upiId', 'registrationMode'].forEach(key => body.append(key, settings[key]));
      body.append('removeQr', String(removeQr)); if (qr) body.append('paymentQr', qr);
      const result = await api('/admin/settings', { method: 'PUT', body });
      setSettings(result.settings); setQr(null); setRemoveQr(false); setSuccess('Payment and registration settings saved.'); await refreshConfig();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="settings-layout"><div className="panel settings-panel"><h2><Settings2 size={22} /> Payment & registration settings</h2><p>Keep the recipient details accurate. Players see this QR during the payment step.</p>{error && <Alert>{error}</Alert>}{success && <Alert tone="success">{success}</Alert>}{!settings ? !error && <Loading /> : <form onSubmit={save}><Field id="payeeName" label="Payment recipient name" value={settings.payeeName} onChange={set('payeeName')} required minLength={2} maxLength={100} /><Field id="upiId" label="UPI ID" value={settings.upiId} onChange={set('upiId')} placeholder="name@bank" hint="A ₹150 QR is generated automatically when no custom QR image is uploaded." /><FileUpload id="paymentQr" label="Replace payment QR (optional)" optional file={qr} onChange={(file, fileError) => { setQr(file); setError(fileError); }} /><label className="checkbox-line"><input type="checkbox" checked={removeQr} onChange={event => setRemoveQr(event.target.checked)} /><span>Remove the uploaded QR and use the UPI-generated QR instead.</span></label><Field id="registrationMode" label="Registration availability"><select id="registrationMode" value={settings.registrationMode} onChange={set('registrationMode')}><option value="scheduled">Follow announced dates (24 Nov – 20 Dec 2026)</option><option value="open">Open registration now</option><option value="closed">Close registration</option></select></Field><button className="button" disabled={busy}><Save size={17} /> {busy ? 'Saving…' : 'Save settings'}</button></form>}</div><aside className="panel settings-preview"><QrCode size={26} /><h3>Current player payment QR</h3>{settings && (settings.upiId || settings.qrFileId) ? <><img src={`${API_BASE}/api/payment/qr?v=${settings.updatedAt}`} alt="Current registration payment QR" /><strong>{settings.payeeName}</strong><code>{settings.upiId}</code><span>₹150 · Player registration</span></> : <p>Add a UPI ID or upload the verified payment QR.</p>}<p className="small-note">In-app notifications are enabled. SMS and WhatsApp messages are not sent.</p></aside></div>;
}
