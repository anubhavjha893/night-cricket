import React, { useEffect, useRef } from "react";
import { FileImage, X } from "lucide-react";
import { PlayerPoster } from "../common/PlayerPoster";

export default function AdminPosterDialog({ player, onClose }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="admin-poster-dialog"
      aria-labelledby="admin-poster-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
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
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="admin-poster-heading">
        <div>
          <span className="admin-poster-icon" aria-hidden="true">
            <FileImage size={22} />
          </span>
          <div>
            <p className="eyebrow">REGISTRATION POSTER</p>
            <h2 id="admin-poster-title">{player.name}</h2>
          </div>
        </div>
        <button
          ref={closeButton}
          type="button"
          className="icon-button"
          aria-label="Close registration poster"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <PlayerPoster player={player} downloadable />
    </dialog>
  );
}
