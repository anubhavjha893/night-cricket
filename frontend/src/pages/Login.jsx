import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck, UserRound } from "lucide-react";
import { api } from "../services/api";
import { Alert } from "../components/common/Alert";

import { useApp } from "../hooks/useApp";
import { Field } from "../components/forms/Field";

export function Login({ admin = false }) {
  const { user, refreshUser } = useApp();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(admin ? "/admin/login" : "/auth/login", {
        method: "POST",
        body: { [admin ? "email" : "phone"]: identifier, password },
      });
      await refreshUser();
      navigate(admin ? "/admin" : "/dashboard", { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (user?.role === (admin ? "admin" : "player"))
    return <Navigate to={admin ? "/admin" : "/dashboard"} replace />;
  return (
    <section className="wrap login-layout page-space">
      <div className="login-intro">
        <p className="eyebrow">
          {admin ? "ORGANISING COMMITTEE" : "YOUR SEASON, AT A GLANCE"}
        </p>
        <h1 className="page-title">
          {admin ? (
            <>
              Behind every
              <br />
              <em>great game.</em>
            </>
          ) : (
            <>
              Back for your
              <br />
              <em>next innings?</em>
            </>
          )}
        </h1>
        <p>
          {admin
            ? "A simple workspace to review players, verify payments and keep every applicant informed."
            : "Your registration, verification status and tournament updates. All in one place."}
        </p>
        <div className="login-detail">
          <ShieldCheck size={26} />
          <p>
            {admin
              ? "Only authorised organisers can review applications and access payment proofs."
              : "Use the mobile number and password you chose during registration."}
          </p>
        </div>
      </div>
      <div className="login-card">
        <span className="login-icon">
          {admin ? <ShieldCheck /> : <UserRound />}
        </span>
        <h2>{admin ? "Admin sign in" : "Player sign in"}</h2>
        <p>
          {admin
            ? "Welcome back to the organising desk."
            : "Let’s check on your application."}
        </p>
        {error && <Alert>{error}</Alert>}
        <form onSubmit={submit}>
          <Field
            id={admin ? "admin-email" : "login-phone"}
            label={admin ? "Email address" : "Mobile number"}
            type={admin ? "email" : "tel"}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            placeholder={
              admin ? "organiser@example.com" : "10-digit Indian mobile number"
            }
            required
          />
          <Field
            id={admin ? "admin-password" : "login-password"}
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            maxLength={128}
          />
          <button className="button full-width" disabled={busy}>
            {busy
              ? "Signing in…"
              : admin
                ? "Open admin panel"
                : "View my registration"}
          </button>
        </form>
        <p className="login-bottom">
          {admin ? (
            <Link to="/login">Player sign in</Link>
          ) : (
            <>
              New to Season 2? <Link to="/register">Register as a player</Link>
            </>
          )}
        </p>
        <p className="small-note">
          Forgot your password? Contact the tournament organisers for
          assistance.
        </p>
      </div>
    </section>
  );
}
