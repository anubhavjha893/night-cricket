import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  MessageCircle,
  X,
  ExternalLink,
} from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/useApp";
import { Alert } from "../common/Alert";
import {
  buildWhatsAppLink,
  buildWhatsAppMessage,
  formatWhatsAppNumber,
} from "../../utils/whatsapp";
import "../../styles/whatsapp.css";

export function WhatsAppMessageDialog({ contact, onClose }) {
  const { config } = useApp();
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const [status, setStatus] = useState(contact.status || "");
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState("");
  const [refresh, setRefresh] = useState(0);
  function selectMessage(type) {
    setStatus(type);
    // The chooser is replaced by the preview; retain focus on a persistent control.
    closeButton.current?.focus();
  }
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
      else
        document
          .querySelector(".review-whatsapp-button, .player-list-panel button")
          ?.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setSettingsError("");
    api("/admin/settings", { signal: controller.signal })
      .then(setSettings)
      .catch((error) => {
        if (!controller.signal.aborted) setSettingsError(error.message);
      });
    return () => controller.abort();
  }, [refresh]);
  let href = "",
    message = "",
    phone = "",
    error = "";
  try {
    phone = formatWhatsAppNumber(contact.player.phone);
    if (status && (status === "rejected" || settings)) {
      const options = {
        player: contact.player,
        tournament: config,
        status,
        auctionDate: settings?.auctionDate || "",
      };
      href = buildWhatsAppLink(options);
      message = buildWhatsAppMessage(options);
    }
  } catch (problem) {
    error = problem.message;
  }
  return (
    <dialog
      ref={dialog}
      className="whatsapp-dialog"
      aria-labelledby="whatsapp-title"
      aria-describedby="whatsapp-notice"
      onKeyDown={(event) => {
        if (
          event.key !== "Tab" ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        const controls = Array.from(
          dialog.current.querySelectorAll(
            'button:not(:disabled), a[href], [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="whatsapp-dialog-heading">
        <span className="whatsapp-dialog-icon">
          <MessageCircle size={23} />
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Close WhatsApp message"
          ref={closeButton}
          onClick={onClose}
          autoFocus
        >
          <X size={20} />
        </button>
      </div>
      <p className="eyebrow">PLAYER COMMUNICATION</p>
      <h2 id="whatsapp-title">
        {status
          ? `Send ${status === "approved" ? "approval" : "rejection"} message on WhatsApp?`
          : "Send a WhatsApp message"}
      </h2>
      <p className="whatsapp-recipient">
        <strong>{contact.player.name}</strong>
        <span>{phone ? `+${phone}` : contact.player.phone}</span>
      </p>
      {!contact.status && !status && (
        <fieldset className="whatsapp-message-types">
          <legend>Choose a message</legend>
          <button
            type="button"
            aria-pressed={status === "approved"}
            onClick={() => selectMessage("approved")}
          >
            <CheckCircle2 size={17} /> Registration Approved
          </button>
          <button
            type="button"
            aria-pressed={status === "rejected"}
            onClick={() => selectMessage("rejected")}
          >
            <XCircle size={17} /> Registration Rejected
          </button>
        </fieldset>
      )}
      {!contact.status && status && (
        <div className="whatsapp-selected-type">
          <span>
            {status === "approved"
              ? "Registration Approved"
              : "Registration Rejected"}
          </span>
          <button
            type="button"
            className="text-link"
            onClick={() => selectMessage("")}
          >
            Change message
          </button>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      {status === "approved" && !settings && !settingsError && (
        <p role="status">Loading auction date…</p>
      )}
      {status === "approved" && settingsError && (
        <Alert>
          Could not load the auction date.{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Try again
          </button>
        </Alert>
      )}
      {status === "approved" && settings && !settings.auctionDate && (
        <p className="small-note">
          Auction date is not set. This message says it will be announced soon.
          Set the date in Payment & settings when ready.
        </p>
      )}
      {message && (
        <div
          className="whatsapp-message-preview"
          aria-label="WhatsApp message preview"
        >
          {message}
        </div>
      )}
      <p id="whatsapp-notice" className="small-note">
        This opens a prefilled chat in your WhatsApp. Press Send yourself there.
        Opening a chat is not a sent or delivery confirmation. This action does
        not change the player's registration status.
      </p>
      <div className="whatsapp-dialog-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onClose}
        >
          No, not right now
        </button>
        {href && !error && (
          <a
            className="button button-success"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            <ExternalLink size={17} /> Open WhatsApp
          </a>
        )}
      </div>
    </dialog>
  );
}
