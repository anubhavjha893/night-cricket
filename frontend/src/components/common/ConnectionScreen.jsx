import React, { useEffect, useRef, useState } from "react";
import { LoaderCircle, WifiOff, RefreshCw } from "lucide-react";
import { useApp } from "../../hooks/useApp";
import "../../styles/connection.css";

export function ConnectionScreen() {
  const {
    startupComplete,
    startupError,
    authLoading,
    configLoading,
    retryConnection,
  } = useApp();
  const [slow, setSlow] = useState(false);
  const dialog = useRef(null);
  const retryButton = useRef(null);
  const busy = authLoading || configLoading;
  const failed = !busy && Boolean(startupError);
  const visible = !startupComplete && (slow || failed);
  useEffect(() => {
    if (startupComplete || !busy) return;
    const timer = setTimeout(() => setSlow(true), 1200);
    return () => clearTimeout(timer);
  }, [startupComplete, busy]);
  useEffect(() => {
    if (!visible) return;
    const element = dialog.current,
      previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [visible]);
  useEffect(() => {
    if (visible) (failed ? retryButton.current : dialog.current)?.focus();
  }, [visible, failed]);
  return (
    <dialog
      ref={dialog}
      className="connection-screen"
      aria-labelledby="connection-title"
      aria-describedby="connection-description"
      tabIndex={-1}
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          (failed ? retryButton.current : dialog.current)?.focus();
        }
      }}
    >
      <div className="connection-card">
        <span className="connection-brand">
          UGM <small>SEASON 2</small>
        </span>
        <div
          className={`connection-orbit ${failed ? "connection-failed" : ""}`}
          aria-hidden="true"
        >
          {failed ? <WifiOff size={34} /> : <LoaderCircle size={42} />}
        </div>
        <p className="eyebrow">YOUR NEXT INNINGS</p>
        <h2 id="connection-title">
          {failed ? "Unable to connect right now." : "Getting things ready."}
        </h2>
        <p id="connection-description" role="status" aria-live="polite">
          {failed
            ? "Please try again in a moment. Any form already open will stay in place."
            : "Please wait while we connect to the registration service. The first connection may take up to a minute."}
        </p>
        {failed ? (
          <button
            ref={retryButton}
            className="button"
            onClick={retryConnection}
          >
            <RefreshCw size={17} /> Retry connection
          </button>
        ) : (
          <div className="connection-progress" aria-hidden="true">
            <span />
          </div>
        )}
        <p className="connection-footnote">
          {failed
            ? "If this continues, please contact the tournament organisers."
            : "Keep this page open. You will continue automatically when the connection is ready."}
        </p>
      </div>
    </dialog>
  );
}
