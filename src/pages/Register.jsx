import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Check, UserRound, Shirt, QrCode, ReceiptText, Copy, ShieldCheck, LockKeyhole, ChevronLeft, IndianRupee } from 'lucide-react';
import { api, API_BASE } from '../api';
import { Alert, Loading, useApp } from '../ui';
import { Field, FileUpload } from '../components';

const steps = [{ title: 'Personal details', caption: 'Let’s get to know you', icon: UserRound }, { title: 'Player profile', caption: 'Your game, your identity', icon: Shirt }, { title: 'Registration payment', caption: 'One step closer to the field', icon: QrCode }, { title: 'Proof & submit', caption: 'Ready for your next innings', icon: ReceiptText }];
const roles = ['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'];

export function Register() {
  const { config, configError, configLoading, refreshConfig, refreshUser, user } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name: '', age: '', phone: '', password: '', address: '', roles: [], tshirtSize: '', transactionReference: '', declaration: false });
  const [playerPhoto, setPlayerPhoto] = useState(null);
  const [paymentProof, setPaymentProof] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState('');
  const [qrError, setQrError] = useState(false);
  const info = steps[step];
  useEffect(() => {
    let live = true; setQrError(false);
    if (!config.payment.upiId) { setQr(''); return; }
    const params = new URLSearchParams({ pa: config.payment.upiId, pn: config.payment.payeeName, am: String(config.fee), cu: 'INR', tn: 'UGM Season 2 registration' });
    QRCode.toDataURL(`upi://pay?${params}`, { width: 400, margin: 3, errorCorrectionLevel: 'M' }).then(url => { if (live) setQr(url); });
    return () => { live = false; };
  }, [config]);
  useEffect(() => {
    const confirmExit = event => { if (data.name && !busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', confirmExit); return () => window.removeEventListener('beforeunload', confirmExit);
  }, [data.name, busy]);
  const set = key => event => { setData(previous => ({ ...previous, [key]: event.target.value })); setErrors(previous => ({ ...previous, [key]: '' })); };
  function next(event) {
    event.preventDefault(); setError('');
    if (step === 1) {
      const nextErrors = {};
      if (!data.roles.length) nextErrors.roles = 'Choose at least one playing role.';
      if (!data.tshirtSize) nextErrors.tshirtSize = 'Choose your T-shirt size.';
      if (!playerPhoto) nextErrors.playerPhoto = 'Please upload your player photograph.';
      setErrors(nextErrors); if (Object.keys(nextErrors).length) return;
    }
    setStep(previous => previous + 1); document.getElementById('registration-form-title')?.focus();
  }
  async function submit(event) {
    event.preventDefault(); setError('');
    if (!paymentProof) { setErrors(previous => ({ ...previous, paymentProof: 'Please upload your payment screenshot.' })); return; }
    if (!data.declaration) { setError('Please accept the declaration before submitting.'); return; }
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(data).forEach(([key, value]) => body.append(key, key === 'roles' ? JSON.stringify(value) : String(value)));
      body.append('playerPhoto', playerPhoto); body.append('paymentProof', paymentProof);
      await api('/registrations', { method: 'POST', body });
      await refreshUser(); navigate('/dashboard', { replace: true });
    } catch (error) { setError(error.message); if (error.errors) { setErrors(error.errors); if (['name', 'age', 'phone', 'password', 'address'].some(key => error.errors[key])) setStep(0); else if (['roles', 'tshirtSize'].some(key => error.errors[key])) setStep(1); } }
    finally { setBusy(false); }
  }
  async function copyUpi() { try { await navigator.clipboard.writeText(config.payment.upiId); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setError('Copy is unavailable. Please select and copy the UPI ID shown below.'); } }
  const paymentLink = config.payment.upiId ? `upi://pay?${new URLSearchParams({ pa: config.payment.upiId, pn: config.payment.payeeName, am: String(config.fee), cu: 'INR', tn: 'UGM Season 2 registration' })}` : '';
  if (user?.role === 'player') return <section className="wrap narrow page-space"><Alert tone="info">You already have a registration. Check its status in your dashboard.</Alert><Link className="button" to="/dashboard">View my registration</Link></section>;
  return <section className="wrap registration-layout page-space">
    <aside className="registration-sidebar"><Link className="back-link" to="/"><ChevronLeft size={16} /> Back to tournament</Link><p className="eyebrow">SEASON 2 · PLAYER REGISTRATION</p><h1 className="page-title">Your game.<br /><em>Your moment.</em></h1><p>Four simple steps to put your name in the next chapter of Tenughat cricket.</p><div className="sidebar-steps">{steps.map((item, index) => <div className={`sidebar-step ${step === index ? 'active' : ''} ${step > index ? 'complete' : ''}`} key={item.title}><span className="step-circle">{step > index ? <Check size={18} /> : <item.icon size={18} />}</span><div><strong>{item.title}</strong><small>{index === step ? 'In progress' : index < step ? 'Completed' : 'Up next'}</small></div></div>)}</div><div className="sidebar-summary"><div><span>Registration fee</span><strong>₹150</strong></div><p><MapPinText />Tenughat Golden Jubilee Ground</p><p>Last date: 20 December 2026</p></div><p className="safe-note"><LockKeyhole size={15} /> Your documents are visible only to you and the organising team.</p></aside>
    <div className="registration-card"><div className="form-topline"><span>PLAYER APPLICATION</span><span>Step {step + 1} of 4</span></div><div className="progress-bar"><span style={{ width: `${((step + 1) / 4) * 100}%` }} /></div><div className="form-content">
      {configError && <Alert>{configError} <button type="button" className="inline-button" onClick={refreshConfig}>Retry connection</button></Alert>}
      {!configError && !configLoading && !config.registration.isOpen && <Alert tone="info">{config.registration.message} You can explore the form; submission is available during the registration window.</Alert>}
      {configLoading && <Loading>Checking registration availability…</Loading>}
      <div className="form-stage" key={step}><p className="eyebrow">{info.caption}</p><h2 id="registration-form-title" tabIndex={-1}>{info.title}</h2><p className="form-description">{step === 0 ? 'Use accurate details. Your mobile number and password will be your sign-in credentials.' : step === 1 ? 'Help the organisers get to know your playing profile.' : step === 2 ? 'Scan the QR with any UPI app. Verify the recipient before paying.' : 'Attach your payment proof and review your application before submitting.'}</p>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={step === 3 ? submit : next}>
      {step === 0 && <><Field id="name" label="Full name" value={data.name} onChange={set('name')} autoComplete="name" placeholder="Enter your full name" required minLength={2} maxLength={100} error={errors.name} /><div className="form-grid"><Field id="age" label="Age" type="number" value={data.age} onChange={set('age')} min="5" max="100" placeholder="Age in years" required error={errors.age} /><Field id="phone" label="Mobile number" type="tel" value={data.phone} onChange={set('phone')} autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit Indian number" required error={errors.phone} /></div><Field id="address" label="Full address" error={errors.address} required><textarea id="address" value={data.address} onChange={set('address')} placeholder="Locality, town/village, district, state and PIN code" autoComplete="street-address" minLength={10} maxLength={1000} required rows={3} /></Field><Field id="password" label="Create a password" type="password" value={data.password} onChange={set('password')} autoComplete="new-password" minLength={8} maxLength={128} placeholder="At least 8 characters" hint="Keep it safe. You’ll use it to track your application." required error={errors.password} /></>}
      {step === 1 && <><fieldset className="field role-fieldset"><legend>Playing role <span className="required">*</span></legend><small>Select all roles that apply to you.</small><div className="role-grid">{roles.map(role => <label key={role} className={`choice-card ${data.roles.includes(role) ? 'selected' : ''}`}><input type="checkbox" name="roles" value={role} checked={data.roles.includes(role)} onChange={() => { setData(previous => ({ ...previous, roles: previous.roles.includes(role) ? previous.roles.filter(v => v !== role) : [...previous.roles, role] })); setErrors(previous => ({ ...previous, roles: '' })); }} /><span>{role}</span>{data.roles.includes(role) && <Check size={16} />}</label>)}</div>{errors.roles && <span className="field-error">{errors.roles}</span>}</fieldset><fieldset className="field size-fieldset"><legend>T-shirt size <span className="required">*</span></legend><div className="size-options">{['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => <label key={size} className={data.tshirtSize === size ? 'selected' : ''}><input type="radio" name="tshirtSize" value={size} checked={data.tshirtSize === size} onChange={set('tshirtSize')} /><span>{size}</span></label>)}</div>{errors.tshirtSize && <span className="field-error">{errors.tshirtSize}</span>}</fieldset><FileUpload id="playerPhoto" label="Player photograph" portrait file={playerPhoto} error={errors.playerPhoto} onChange={(file, error) => { setPlayerPhoto(file); setErrors(previous => ({ ...previous, playerPhoto: error })); }} /></>}
      {step === 2 && <div className="payment-stage">{config.payment.configured ? <><div className="payment-card"><div className="payment-card-top"><span>REGISTRATION FEE</span><ShieldCheck size={20} /></div><div className="payment-amount"><IndianRupee size={36} /><strong>150</strong><span>INR</span></div><div className="qr-frame">{qrError ? <p>The QR could not load. Use the UPI ID below.</p> : qr ? <img src={config.payment.uploadedQr ? `${config.payment.qrUrl}` : qr} alt="UPI QR code for ₹150 registration payment to Anubhav Jha" onError={() => setQrError(true)} /> : <Loading>Preparing payment QR…</Loading>}</div><span className="pay-to">PAY TO</span><h3>{config.payment.payeeName}</h3><button className="copy-upi" type="button" onClick={copyUpi}>{config.payment.upiId}<Copy size={15} /><span className="sr-only">{copied ? 'Copied' : 'Copy UPI ID'}</span></button>{copied && <span className="copied-message" role="status">UPI ID copied</span>}{paymentLink && <a className="button button-dark upi-link" href={paymentLink}>Pay with a UPI app</a>}</div><div className="payment-tip"><ShieldCheck size={22} /><p>Check the recipient details in your UPI app. After paying, keep the screenshot and transaction reference ready. Payment is verified manually by the organisers.</p></div></> : <Alert>Payment is not available yet. Please contact the organisers before making a payment.</Alert>}</div>}
      {step === 3 && <><div className="review-summary"><div><span>PLAYER</span><strong>{data.name}</strong><small>{data.phone} · {data.age} years</small></div><div><span>PROFILE</span><strong>{data.roles.join(' / ')}</strong><small>T-shirt size: {data.tshirtSize}</small></div><div><span>PAYMENT</span><strong>₹150</strong><small>{config.payment.payeeName}</small></div></div><FileUpload id="paymentProof" label="Payment screenshot" file={paymentProof} error={errors.paymentProof} onChange={(file, error) => { setPaymentProof(file); setErrors(previous => ({ ...previous, paymentProof: error })); }} /><Field id="transactionReference" label="Transaction reference / UTR" value={data.transactionReference} onChange={set('transactionReference')} minLength={6} maxLength={64} pattern="[a-zA-Z0-9-]+" placeholder="Enter the reference shown on your receipt" hint="This helps the organisers match and verify your payment." required error={errors.transactionReference} /><label className="checkbox-line"><input type="checkbox" checked={data.declaration} onChange={event => setData(previous => ({ ...previous, declaration: event.target.checked }))} required /><span>I confirm that my details are accurate. I understand that my registration is subject to verification by the organising committee and that updates will be shown in my player dashboard.</span></label></>}
      <div className="form-actions">{step > 0 ? <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setStep(previous => previous - 1); setError(''); }}>Back</button> : <Link to="/login" className="text-link">Already registered?</Link>}<button className="button" type="submit" disabled={busy || (step === 2 && (!config.payment.configured || Boolean(configError))) || (step === 3 && (Boolean(configError) || !config.registration.isOpen || configLoading))}>{busy ? 'Submitting…' : step === 3 ? 'Submit registration' : step === 2 ? 'I’ve paid · Upload proof' : 'Continue'}</button></div></form></div>
    </div><div className="application-footer"><ShieldCheck size={15} /> Reviewed by the tournament organising committee</div></div>
  </section>;
}
function MapPinText() { return <span aria-hidden="true">◉ </span>; }
