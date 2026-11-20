import React, { useEffect, useState } from "react";
import { Settings2, Save, QrCode } from "lucide-react";
import { api, API_BASE } from "../../services/api";
import { Alert } from "../../components/common/Alert";

import { Loading } from "../../components/common/Loading";

import { useApp } from "../../hooks/useApp";
import { Field } from "../../components/forms/Field";
import { FileUpload } from "../../components/forms/FileUpload";

export function AdminSettings() {
  const { refreshConfig } = useApp();
  const [settings, setSettings] = useState(null);
  const [qr, setQr] = useState(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/admin/settings")
      .then(setSettings)
      .catch((error) => setError(error.message));
  }, []);
  const set = (key) => (event) =>
    setSettings((previous) => ({ ...previous, [key]: event.target.value }));
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const body = new FormData();
      ["payeeName", "upiId", "registrationMode"].forEach((key) =>
        body.append(key, settings[key]),
      );
      body.append("removeQr", String(removeQr));
      body.append("auctionDate", settings.auctionDate || "");
      if (qr) body.append("paymentQr", qr);
      const result = await api("/admin/settings", { method: "PUT", body });
      setSettings(result.settings);
      setQr(null);
      setRemoveQr(false);
      setSuccess("Payment and registration settings saved.");
      await refreshConfig();
    } catch (error) {
      setError(error.errors?.auctionDate?.[0] || error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-layout">
      <div className="panel settings-panel">
        <h2>
          <Settings2 size={22} /> Payment, registration & auction settings
        </h2>
        <p>
          Keep the recipient details accurate. Players see this QR during the
          payment step.
        </p>
        {error && <Alert>{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}
        {!settings ? (
          !error && <Loading />
        ) : (
          <form onSubmit={save}>
            <Field
              id="payeeName"
              label="Payment recipient name"
              value={settings.payeeName}
              onChange={set("payeeName")}
              required
              minLength={2}
              maxLength={100}
            />
            <Field
              id="upiId"
              label="UPI ID"
              value={settings.upiId}
              onChange={set("upiId")}
              placeholder="name@bank"
              hint="A ₹150 QR is generated automatically when no custom QR image is uploaded."
            />
            <FileUpload
              id="paymentQr"
              label="Replace payment QR (optional)"
              optional
              file={qr}
              onChange={(file, fileError) => {
                setQr(file);
                setError(fileError);
              }}
            />
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={removeQr}
                onChange={(event) => setRemoveQr(event.target.checked)}
              />
              <span>
                Remove the uploaded QR and use the UPI-generated QR instead.
              </span>
            </label>
            <Field id="registrationMode" label="Registration availability">
              <select
                id="registrationMode"
                value={settings.registrationMode}
                onChange={set("registrationMode")}
              >
                <option value="scheduled">
                  Follow announced dates (24 Nov – 20 Dec 2026)
                </option>
                <option value="open">Open registration now</option>
                <option value="closed">Close registration</option>
              </select>
            </Field>
            <Field
              id="auctionDate"
              label="Auction date"
              type="date"
              value={settings.auctionDate || ""}
              onChange={set("auctionDate")}
              hint="Used in WhatsApp approval messages. Leave blank to say the date will be announced soon."
            />
            <button className="button" disabled={busy}>
              <Save size={17} /> {busy ? "Saving…" : "Save settings"}
            </button>
          </form>
        )}
      </div>
      <aside className="panel settings-preview">
        <QrCode size={26} />
        <h3>Current player payment QR</h3>
        {settings && (settings.upiId || settings.qrFileId) ? (
          <>
            <img
              src={`${API_BASE}/api/payment/qr?v=${settings.updatedAt}`}
              alt="Current registration payment QR"
            />
            <strong>{settings.payeeName}</strong>
            <code>{settings.upiId}</code>
            <span>₹150 · Player registration</span>
          </>
        ) : (
          <p>Add a UPI ID or upload the verified payment QR.</p>
        )}
        <p className="small-note">
          In-app notifications are enabled. WhatsApp buttons open a chat draft;
          you send the message yourself from your own WhatsApp account.
        </p>
      </aside>
    </div>
  );
}
