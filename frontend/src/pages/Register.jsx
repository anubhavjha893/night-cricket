import { appendImage } from "../services/directUpload";
import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { posterTemplate } from "../utils/playerPoster";
import {
  Check,
  UserRound,
  Shirt,
  QrCode,
  ReceiptText,
  Copy,
  ShieldCheck,
  LockKeyhole,
  ChevronLeft,
  IndianRupee,
  CalendarDays,
  Phone,
} from "lucide-react";
import { api, API_BASE } from "../services/api";
import { Alert } from "../components/common/Alert";
import { Loading } from "../components/common/Loading";
import { useApp } from "../hooks/useApp";
import { Field } from "../components/forms/Field";
import { FileUpload } from "../components/forms/FileUpload";
import { PrivateImage } from "../components/common/PrivateImage";

const steps = [
  {
    title: "Personal details",
    caption: "Let’s get to know you",
    icon: UserRound,
  },
  { title: "Player profile", caption: "Your game, your identity", icon: Shirt },
  {
    title: "Registration payment",
    caption: "One step closer to the field",
    icon: QrCode,
  },
  {
    title: "Proof & submit",
    caption: "Ready for your next innings",
    icon: ReceiptText,
  },
];
const roles = ["Batter", "Bowler", "All-rounder", "Wicketkeeper Batsman"];

export function Register() {
  const {
    config,
    configError,
    configLoading,
    refreshConfig,
    setUser,
    submittedPhoto,
    refreshUser,
    user,
    authLoading,
  } = useApp();
  const [checkingWindow, setCheckingWindow] = useState(true);
  useEffect(() => {
    let active = true;
    refreshConfig().finally(() => {
      if (active) setCheckingWindow(false);
    });
    return () => {
      active = false;
    };
  }, [refreshConfig]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wantsCorrection = searchParams.get("correct") === "1";
  const [existing, setExisting] = useState(null);
  const [existingLoading, setExistingLoading] = useState(
    user?.role === "player",
  );
  const [existingError, setExistingError] = useState("");
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [resubmissionKey] = useState(() => crypto.randomUUID());
  const correcting = wantsCorrection && existing?.status === "rejected";
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: "",
    age: "",
    phone: "",
    address: "",
    roles: [],
    tshirtSize: "",
    declaration: false,
  });
  const [playerPhoto, setPlayerPhoto] = useState(null);
  const [paymentProof, setPaymentProof] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("submit");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const [qrError, setQrError] = useState(false);
  const [conflict, setConflict] = useState(false);
  const info = steps[step];
  useEffect(() => {
    if (user?.role !== "player") return;
    const controller = new AbortController();
    setExistingLoading(true);
    setExistingError("");
    api("/player/me", { signal: controller.signal })
      .then((profile) => {
        setExisting(profile);
        if (wantsCorrection && profile.status === "rejected") {
          setData({
            name: profile.name,
            age: String(profile.age),
            phone: profile.phone,
            address: profile.address,
            roles: profile.roles
              .slice(0, 1)
              .map((role) =>
                role === "Wicketkeeper" ? "Wicketkeeper Batsman" : role,
              ),
            tshirtSize: profile.tshirtSize,
            declaration: false,
          });
          setPlayerPhoto(null);
          setPaymentProof(null);
          setStep(0);
          setError("");
          setConflict(false);
        }
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setExistingError(problem.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setExistingLoading(false);
      });
    return () => controller.abort();
  }, [user?.role, wantsCorrection, profileAttempt]);
  useEffect(() => {
    let live = true;
    setQrError(false);
    if (step < 1 || !config.payment.upiId) {
      setQr("");
      return;
    }
    const params = new URLSearchParams({
      pa: config.payment.upiId,
      pn: config.payment.payeeName,
      am: String(config.fee),
      cu: "INR",
      tn: "UGM Season 2 registration",
    });
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(`upi://pay?${params}`, {
          width: 400,
          margin: 3,
          errorCorrectionLevel: "M",
        }),
      )
      .then((url) => {
        if (live) setQr(url);
      })
      .catch(() => {
        if (live) setQrError(true);
      });
    return () => {
      live = false;
    };
  }, [config, step < 1]);
  useEffect(() => {
    const confirmExit = (event) => {
      if (data.name && !busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", confirmExit);
    return () => window.removeEventListener("beforeunload", confirmExit);
  }, [data.name, busy]);
  const set = (key) => (event) => {
    setData((previous) => ({ ...previous, [key]: event.target.value }));
    setErrors((previous) => ({ ...previous, [key]: "" }));
  };
  function next(event) {
    event.preventDefault();
    setError("");
    if (step === 1) {
      const nextErrors = {};
      if (!data.roles.length) nextErrors.roles = "Choose one playing role.";
      if (!data.tshirtSize) nextErrors.tshirtSize = "Choose your T-shirt size.";
      if (!playerPhoto && !(correcting && existing.playerPhotoId))
        nextErrors.playerPhoto = "Please upload your player photograph.";
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
    }
    setStep((previous) => previous + 1);
    document.getElementById("registration-form-title")?.focus();
  }
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!paymentProof && !(correcting && existing.paymentProofId)) {
      setErrors((previous) => ({
        ...previous,
        paymentProof: "Please upload your payment screenshot.",
      }));
      return;
    }
    if (!data.declaration) {
      setError("Please accept the declaration before submitting.");
      return;
    }
    setBusyAction("submit");
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(data).forEach(([key, value]) =>
        body.append(
          key,
          key === "roles" ? JSON.stringify(value) : String(value),
        ),
      );
      const template = new Image();
      template.src = posterTemplate;
      const results = await Promise.allSettled([
        playerPhoto &&
          appendImage(body, "playerPhoto", playerPhoto, correcting),
        paymentProof &&
          appendImage(body, "paymentProof", paymentProof, correcting),
      ]);
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
      if (correcting)
        body.append(
          "submissionRevision",
          String(existing.submissionRevision || 0),
        );
      const result = await api(
        correcting ? "/player/resubmit" : "/registrations",
        {
          method: "POST",
          body,
          ...(correcting
            ? { headers: { "Idempotency-Key": resubmissionKey } }
            : {}),
        },
      );
      if (result.playerPhotoId && playerPhoto) {
        submittedPhoto.current = {
          id: result.playerPhotoId,
          file: playerPhoto,
        };
      }
      if (result.user) setUser(result.user);
      else await refreshUser();
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setError(error.message);
      if (!correcting && error.status === 409) await refreshConfig();
      if (correcting && error.status === 409) setConflict(true);
      if (error.errors) {
        setErrors(error.errors);
        if (
          ["name", "age", "phone", "password", "address"].some(
            (key) => error.errors[key],
          )
        )
          setStep(0);
        else if (["roles", "tshirtSize"].some((key) => error.errors[key]))
          setStep(1);
      }
    } finally {
      setBusy(false);
    }
  }
  async function signInWithPhone() {
    setError("");
    setBusyAction("sign-in");
    setBusy(true);
    try {
      await api("/auth/login", {
        method: "POST",
        body: { phone: data.phone, password: data.phone },
      });
      await refreshUser();
      navigate("/dashboard", { replace: true });
    } catch (problem) {
      setError(
        problem.status === 401
          ? "Could not sign in with this number. Use the regular sign-in page if your account has a different password."
          : problem.message,
      );
    } finally {
      setBusy(false);
      setBusyAction("submit");
    }
  }
  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(config.payment.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        "Copy is unavailable. Please select and copy the UPI ID shown below.",
      );
    }
  }
  const paymentLink = config.payment.upiId
    ? `upi://pay?${new URLSearchParams({ pa: config.payment.upiId, pn: config.payment.payeeName, am: String(config.fee), cu: "INR", tn: "UGM Season 2 registration" })}`
    : "";
  if (authLoading || (user?.role === "player" && existingLoading))
    return <Loading>Loading your registration…</Loading>;
  if (wantsCorrection && user?.role !== "player")
    return (
      <Navigate to={user?.role === "admin" ? "/admin" : "/login"} replace />
    );
  if (user?.role === "player" && existingError)
    return (
      <section className="wrap narrow page-space">
        <Alert>{existingError}</Alert>
        <button
          className="button"
          onClick={() => setProfileAttempt((value) => value + 1)}
        >
          Try again
        </button>
      </section>
    );
  if (user?.role === "player" && !correcting)
    return (
      <section className="wrap narrow page-space">
        <Alert tone="info">
          You already have a registration. Check its status in your dashboard.
        </Alert>
        <Link className="button" to="/dashboard">
          View my registration
        </Link>
        {existing?.status === "rejected" && (
          <Link className="button button-secondary" to="/register?correct=1">
            Correct & resubmit
          </Link>
        )}
      </section>
    );
  if (!correcting && (checkingWindow || configLoading))
    return <Loading>Checking registration availability…</Loading>;
  if (!correcting && configError)
    return (
      <section className="wrap narrow page-space">
        <Alert>{configError}</Alert>
        <button className="button" onClick={refreshConfig}>
          Retry connection
        </button>
      </section>
    );
  if (!correcting && !config.registration.isOpen) {
    const upcoming =
      config.registration.phase === "upcoming" ||
      (!config.registration.phase &&
        config.registration.message.startsWith("Registration opens"));
    const opens =
      upcoming &&
      new Intl.DateTimeFormat("en-IN", {
        dateStyle: "long",
        timeZone: "Asia/Kolkata",
      }).format(new Date(config.opensAt));
    return (
      <section
        className="wrap narrow page-space"
        aria-labelledby="window-heading"
      >
        <div className="registration-card window-card">
          <CalendarDays size={32} aria-hidden="true" />
          <p className="eyebrow">SEASON 2 · PLAYER REGISTRATION</p>
          <h1 id="window-heading" className="page-title">
            {upcoming ? "Registration opens soon." : "Registration closed."}
          </h1>
          <p>
            {upcoming ? (
              <>
                You can register from <strong>{opens}</strong>.
              </>
            ) : (
              "New player applications are closed."
            )}
          </p>
          <p>Contact the tournament owner</p>
          <a className="button" href="tel:+918825170314">
            <Phone size={17} />
            8825170314
          </a>
          <Link className="back-link" to="/">
            Back to tournament
          </Link>
          <Link className="back-link" to="/login">Already registered? Sign in</Link>
        </div>
      </section>
    );
  }
  return (
    <section className="wrap registration-layout page-space">
      <aside className="registration-sidebar">
        <Link className="back-link" to="/">
          <ChevronLeft size={16} /> Back to tournament
        </Link>
        <p className="eyebrow">SEASON 2 · PLAYER REGISTRATION</p>
        <h1 className="page-title">
          Your game.
          <br />
          <em>Your moment.</em>
        </h1>
        <p>
          {correcting
            ? "Correct the issues below and resubmit the same registration for review."
            : "Four simple steps to put your name in the next chapter of Tenughat cricket."}
        </p>
        <div className="sidebar-steps">
          {steps.map((item, index) => (
            <div
              className={`sidebar-step ${step === index ? "active" : ""} ${step > index ? "complete" : ""}`}
              key={item.title}
            >
              <span className="step-circle">
                {step > index ? <Check size={18} /> : <item.icon size={18} />}
              </span>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {index === step
                    ? "In progress"
                    : index < step
                      ? "Completed"
                      : "Up next"}
                </small>
              </div>
            </div>
          ))}
        </div>
        <div className="sidebar-summary">
          <div>
            <span>Registration fee</span>
            <strong>₹150</strong>
          </div>
          <p>
            <MapPinText />
            Tenughat Golden Jubilee Ground
          </p>
          <p>Last date: 20 December 2026</p>
        </div>
        <p className="safe-note">
          <LockKeyhole size={15} /> Your documents are visible only to you and
          the organising team.
        </p>
      </aside>
      <div className="registration-card">
        <div className="form-topline">
          <span>
            {correcting
              ? `CORRECTION · ${existing.registrationId}`
              : "PLAYER APPLICATION"}
          </span>
          <span>Step {step + 1} of 4</span>
        </div>
        <div className="progress-bar">
          <span style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>
        <div className="form-content">
          {correcting && (
            <Alert tone="info">
              <strong>Reason for rejection: </strong>
              {existing.rejectionReason}
              <p>
                Correct the issue and resubmit. Your registration ID and sign-in
                details stay the same. If you have already paid, do not pay
                again—upload the correct screenshot.
              </p>
            </Alert>
          )}
          {conflict && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setProfileAttempt((value) => value + 1)}
            >
              Reload latest correction form
            </button>
          )}
          {configError && (
            <Alert>
              {configError}{" "}
              <button
                type="button"
                className="inline-button"
                onClick={refreshConfig}
              >
                Retry connection
              </button>
            </Alert>
          )}
          {configLoading && (
            <Loading>
              Connecting to the registration service… The first connection may
              take up to a minute.
            </Loading>
          )}
          <div className="form-stage" key={step}>
            <p className="eyebrow">{info.caption}</p>
            <h2 id="registration-form-title" tabIndex={-1}>
              {info.title}
            </h2>
            <p className="form-description">
              {step === 0
                ? correcting
                  ? "Correct your details below. Your sign-in number and password stay unchanged."
                  : "Use accurate details. Your mobile number will also be your sign-in password."
                : step === 1
                  ? "Help the organisers get to know your playing profile."
                  : step === 2
                    ? "Scan the QR with any UPI app. Verify the recipient before paying."
                    : "Attach your payment proof and review your application before submitting."}
            </p>
            {error && <Alert>{error}</Alert>}
            <form onSubmit={step === 3 ? submit : next}>
              {step === 0 && (
                <>
                  <Field
                    id="name"
                    label="Full name"
                    value={data.name}
                    onChange={set("name")}
                    autoComplete="name"
                    placeholder="Enter your full name"
                    required
                    minLength={2}
                    maxLength={100}
                    error={errors.name}
                  />
                  <div className="form-grid">
                    <Field
                      id="age"
                      label="Age"
                      type="number"
                      value={data.age}
                      onChange={set("age")}
                      min="5"
                      max="100"
                      placeholder="Age in years"
                      required
                      error={errors.age}
                    />
                    <Field
                      id="phone"
                      label="Mobile number"
                      type="tel"
                      value={data.phone}
                      onChange={set("phone")}
                      readOnly={correcting}
                      hint={
                        correcting
                          ? "This is your sign-in number. Contact the organiser if it needs changing."
                          : undefined
                      }
                      autoComplete="tel-national"
                      pattern="[6-9][0-9]{9}"
                      maxLength={10}
                      placeholder="10-digit Indian number"
                      required
                      error={errors.phone}
                    />
                  </div>
                  {!correcting && (
                    <button
                      className="inline-button phone-sign-in"
                      type="button"
                      disabled={busy || !/^[6-9]\d{9}$/.test(data.phone)}
                      onClick={signInWithPhone}
                    >
                      Already registered? Sign in with this number
                    </button>
                  )}
                  <Field
                    id="address"
                    label="Full address"
                    error={errors.address}
                    required
                  >
                    <textarea
                      id="address"
                      value={data.address}
                      onChange={set("address")}
                      placeholder="Locality, town/village, district, state and PIN code"
                      autoComplete="street-address"
                      minLength={10}
                      maxLength={1000}
                      required
                      rows={3}
                    />
                  </Field>
                  {!correcting && (
                    <Field
                      id="password"
                      label="Your sign-in password"
                      type="text"
                      value={data.phone}
                      readOnly
                      autoComplete="off"
                      placeholder="Your mobile number appears here"
                      hint="Automatically filled from your mobile number. Use this number as your password to sign in."
                    />
                  )}
                </>
              )}
              {step === 1 && (
                <>
                  <fieldset className="field role-fieldset">
                    <legend>
                      Playing role <span className="required">*</span>
                    </legend>
                    <small>
                      Choose the role that best describes your game.
                    </small>
                    <div className="role-grid">
                      {roles.map((role) => (
                        <label
                          key={role}
                          className={`choice-card ${data.roles.includes(role) ? "selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name="roles"
                            value={role}
                            checked={data.roles.includes(role)}
                            onChange={() => {
                              setData((previous) => ({
                                ...previous,
                                roles: [role],
                              }));
                              setErrors((previous) => ({
                                ...previous,
                                roles: "",
                              }));
                            }}
                          />
                          <span>{role}</span>
                          {data.roles.includes(role) && <Check size={16} />}
                        </label>
                      ))}
                    </div>
                    {errors.roles && (
                      <span className="field-error">{errors.roles}</span>
                    )}
                  </fieldset>
                  <fieldset className="field size-fieldset">
                    <legend>
                      T-shirt size <span className="required">*</span>
                    </legend>
                    <div className="size-options">
                      {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                        <label
                          key={size}
                          className={data.tshirtSize === size ? "selected" : ""}
                        >
                          <input
                            type="radio"
                            name="tshirtSize"
                            value={size}
                            checked={data.tshirtSize === size}
                            onChange={set("tshirtSize")}
                          />
                          <span>{size}</span>
                        </label>
                      ))}
                    </div>
                    {errors.tshirtSize && (
                      <span className="field-error">{errors.tshirtSize}</span>
                    )}
                  </fieldset>
                  <FileUpload
                    id="playerPhoto"
                    label={
                      correcting
                        ? "Replace player photograph (optional)"
                        : "Player photograph"
                    }
                    optional={correcting}
                    portrait
                    file={playerPhoto}
                    error={errors.playerPhoto}
                    onChange={(file, error) => {
                      setPlayerPhoto(file);
                      setErrors((previous) => ({
                        ...previous,
                        playerPhoto: error,
                      }));
                    }}
                  />
                  {correcting && !playerPhoto && (
                    <div className="correction-current-image">
                      <p className="small-note">
                        Current photograph will be kept unless you replace it.
                      </p>
                      <PrivateImage
                        id={existing.playerPhotoId}
                        alt="Current player photograph"
                      />
                    </div>
                  )}
                </>
              )}
              {step === 2 && (
                <div className="payment-stage">
                  {correcting && (
                    <Alert tone="info">
                      No additional registration fee is charged for corrections.
                      If your original payment was successful, continue and keep
                      or replace its screenshot. Pay only if payment was not
                      received.
                    </Alert>
                  )}
                  {config.payment.configured ? (
                    <>
                      <div className="payment-card">
                        <div className="payment-card-top">
                          <span>REGISTRATION FEE</span>
                          <ShieldCheck size={20} />
                        </div>
                        <div className="payment-amount">
                          <IndianRupee size={36} />
                          <strong>150</strong>
                          <span>INR</span>
                        </div>
                        <div className="qr-frame">
                          {qrError ? (
                            <p>The QR could not load. Use the UPI ID below.</p>
                          ) : qr || config.payment.uploadedQr ? (
                            <img
                              src={
                                config.payment.uploadedQr
                                  ? `${API_BASE}${config.payment.qrUrl}`
                                  : qr
                              }
                              alt={`UPI QR code for ₹${config.fee} registration payment to ${config.payment.payeeName}`}
                              onError={() => setQrError(true)}
                            />
                          ) : (
                            <Loading>Preparing payment QR…</Loading>
                          )}
                        </div>
                        <span className="pay-to">PAY TO</span>
                        <h3>{config.payment.payeeName}</h3>
                        <button
                          className="copy-upi"
                          type="button"
                          onClick={copyUpi}
                        >
                          {config.payment.upiId}
                          <Copy size={15} />
                          <span className="sr-only">
                            {copied ? "Copied" : "Copy UPI ID"}
                          </span>
                        </button>
                        {copied && (
                          <span className="copied-message" role="status">
                            UPI ID copied
                          </span>
                        )}
                        {paymentLink && (
                          <a
                            className="button button-dark upi-link"
                            href={paymentLink}
                          >
                            Pay with a UPI app
                          </a>
                        )}
                      </div>
                      <div className="payment-tip">
                        <ShieldCheck size={22} />
                        <p>
                          Check the recipient details in your UPI app. After
                          paying, keep your payment screenshot ready. Payment is
                          verified manually by the organisers.
                        </p>
                      </div>
                    </>
                  ) : (
                    <Alert>
                      Payment is not available yet. Please contact the
                      organisers before making a payment.
                    </Alert>
                  )}
                </div>
              )}
              {step === 3 && (
                <>
                  <div className="review-summary">
                    <div>
                      <span>PLAYER</span>
                      <strong>{data.name}</strong>
                      <small>
                        {data.phone} · {data.age} years
                      </small>
                    </div>
                    <div>
                      <span>PROFILE</span>
                      <strong>{data.roles.join(" / ")}</strong>
                      <small>T-shirt size: {data.tshirtSize}</small>
                    </div>
                    <div>
                      <span>PAYMENT</span>
                      <strong>₹150</strong>
                      <small>{config.payment.payeeName}</small>
                    </div>
                  </div>
                  <FileUpload
                    id="paymentProof"
                    label={
                      correcting
                        ? "Replace payment screenshot (optional)"
                        : "Payment screenshot"
                    }
                    optional={correcting}
                    file={paymentProof}
                    error={errors.paymentProof}
                    onChange={(file, error) => {
                      setPaymentProof(file);
                      setErrors((previous) => ({
                        ...previous,
                        paymentProof: error,
                      }));
                    }}
                  />
                  {correcting && !paymentProof && (
                    <div className="correction-current-image">
                      <p className="small-note">
                        Current payment screenshot. Replace it above if the
                        rejection was about this screenshot.
                      </p>
                      <PrivateImage
                        id={existing.paymentProofId}
                        alt="Current payment screenshot"
                      />
                    </div>
                  )}
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={data.declaration}
                      onChange={(event) =>
                        setData((previous) => ({
                          ...previous,
                          declaration: event.target.checked,
                        }))
                      }
                      required
                    />
                    <span>
                      I confirm that my details are accurate. I understand that
                      my registration is subject to verification by the
                      organising committee and that updates will be shown in my
                      player dashboard.
                    </span>
                  </label>
                </>
              )}
              <div className="form-actions">
                {step > 0 ? (
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep((previous) => previous - 1);
                      setError("");
                    }}
                  >
                    Back
                  </button>
                ) : (
                  <Link to="/login" className="text-link">
                    Already registered?
                  </Link>
                )}
                <button
                  className="button"
                  type="submit"
                  disabled={
                    busy ||
                    (!correcting &&
                      step === 2 &&
                      (!config.payment.configured || Boolean(configError))) ||
                    (!correcting &&
                      step === 3 &&
                      (Boolean(configError) ||
                        !config.registration.isOpen ||
                        configLoading))
                  }
                >
                  {busy
                    ? "Submitting…"
                    : step === 3
                      ? correcting
                        ? "Resubmit for verification"
                        : "Submit registration"
                      : step === 2
                        ? correcting
                          ? "Continue to payment proof"
                          : "I’ve paid · Upload proof"
                        : "Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="application-footer">
          <ShieldCheck size={15} /> Reviewed by the tournament organising
          committee
        </div>
      </div>
      {busy && (
        <div className="submission-overlay" role="status" aria-live="polite">
          <div className="submission-message">
            <span className="spinner" aria-hidden="true" />
            <strong>
              {busyAction === "sign-in"
                ? "Signing you in…"
                : correcting
                  ? "Submitting your correction…"
                  : "Submitting your registration…"}
            </strong>
            <span>
              {busyAction === "sign-in"
                ? "Checking your registration."
                : "Please wait a moment."}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
function MapPinText() {
  return <span aria-hidden="true">◉ </span>;
}
