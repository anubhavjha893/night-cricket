import React, { useEffect, useState } from "react";
import { X, Check, ShieldCheck, MessageCircle } from "lucide-react";
import { api } from "../../services/api";
import { Alert } from "../../components/common/Alert";
import { formatDate } from "../../utils/formatDate";
import { Loading } from "../../components/common/Loading";
import { StatusBadge } from "../../components/common/StatusBadge";

import { Field } from "../../components/forms/Field";

import { PrivateImage } from "../../components/common/PrivateImage";

export function PlayerReview({ id, onClose, onDecision, onWhatsApp }) {
  const [player, setPlayer] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verified, setVerified] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const updated = await api(`/admin/players/${id}`);
    setPlayer(updated);
    return updated;
  }
  useEffect(() => {
    let active = true;
    setPlayer(null);
    setError("");
    setSuccess("");
    setVerified(false);
    setRejecting(false);
    setReason("");
    api(`/admin/players/${id}`)
      .then((result) => {
        if (active) setPlayer(result);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function decide(status) {
    if (status === "approved" && !verified) return;
    if (status === "rejected" && reason.trim().length < 5) {
      setError(
        "Please give a clear rejection reason of at least 5 characters.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await api(`/admin/players/${id}/decision`, {
        method: "PATCH",
        body: {
          status,
          reason,
          submissionRevision: player.submissionRevision || 0,
        },
      });
      const updated = await load();
      setSuccess(result.message);
      onDecision({ player: updated, status });
    } catch (error) {
      setError(error.message);
      if (error.status === 409) {
        setVerified(false);
        setRejecting(false);
        setReason("");
        await load();
        onDecision();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel review-panel"
      aria-label="Player application details"
    >
      <div className="panel-heading">
        <h2>Player application</h2>
        <button
          className="icon-button"
          aria-label="Close player details"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}
      {!player ? (
        !error && <Loading>Loading application…</Loading>
      ) : (
        <>
          <div className="review-player-heading">
            <PrivateImage
              id={player.playerPhotoId}
              alt={`${player.name} player photograph`}
              className="review-photo"
            />
            <div>
              <StatusBadge status={player.status} />
              <h3>{player.name}</h3>
              <p>{player.registrationId}</p>
            </div>
          </div>
          {player.submissionRevision > 0 && (
            <Alert tone="info">
              Corrected submission #{player.submissionRevision}. Review the
              updated details and images before making a decision.
            </Alert>
          )}
          <dl className="detail-grid">
            <div>
              <dt>Mobile number</dt>
              <dd>
                <a href={`tel:${player.phone}`}>{player.phone}</a>
                <button
                  type="button"
                  className="whatsapp-row-button review-whatsapp-button"
                  onClick={() => onWhatsApp(player)}
                >
                  <MessageCircle size={15} /> Send message
                </button>
              </dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{player.age} years</dd>
            </div>
            <div>
              <dt>Playing role</dt>
              <dd>{player.roles.join(", ")}</dd>
            </div>
            <div>
              <dt>T-shirt size</dt>
              <dd>{player.tshirtSize}</dd>
            </div>
            <div className="span-2">
              <dt>Full address</dt>
              <dd>{player.address}</dd>
            </div>
            <div className="span-2">
              <dt>Submitted</dt>
              <dd>{formatDate(player.createdAt)}</dd>
            </div>
          </dl>
          <div className="payment-review">
            <h3>
              Payment verification <strong>₹{player.paymentAmount}</strong>
            </h3>
            <PrivateImage
              id={player.paymentProofId}
              alt={`${player.name} payment screenshot`}
              className="payment-proof"
            />
            <p className="small-note">
              Click the screenshot to view it at full size. Check the actual
              credit in the payment account before approval.
            </p>
          </div>
          {player.status === "pending" ? (
            <div className="decision-box">
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(event) => setVerified(event.target.checked)}
                />
                <span>
                  I have verified the player details and confirmed receipt of
                  the ₹150 payment.
                </span>
              </label>
              {rejecting && (
                <Field
                  id="rejection-reason"
                  label="Reason for rejection"
                  required
                >
                  <textarea
                    id="rejection-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain clearly what could not be verified. This message will be sent to the player’s in-app inbox."
                    rows={4}
                    minLength={5}
                    maxLength={1000}
                  />
                </Field>
              )}
              <div className="decision-actions">
                {rejecting ? (
                  <>
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => setRejecting(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="button button-danger"
                      disabled={busy || reason.trim().length < 5}
                      onClick={() => decide("rejected")}
                    >
                      {busy ? "Saving…" : "Confirm rejection"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="button button-danger-outline"
                      disabled={busy}
                      onClick={() => setRejecting(true)}
                    >
                      Reject
                    </button>
                    <button
                      className="button button-success"
                      disabled={!verified || busy}
                      onClick={() => decide("approved")}
                    >
                      <Check size={17} />
                      {busy ? "Saving…" : "Approve registration"}
                    </button>
                  </>
                )}
              </div>
              <p className="small-note">
                The player’s status and in-app notification update as soon as
                you save the decision.
              </p>
            </div>
          ) : (
            <div className="reviewed-note">
              <ShieldCheck size={21} />
              <div>
                <strong>Reviewed {formatDate(player.reviewedAt)}</strong>
                <p>
                  {player.status === "rejected"
                    ? player.rejectionReason
                    : "Player details and payment approved. The player has been notified in the app."}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
