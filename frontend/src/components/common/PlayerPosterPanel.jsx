import { appendImage } from "../../services/directUpload";
import React, { useState } from "react";
import { Camera } from "lucide-react";
import { api } from "../../services/api";
import { FileUpload } from "../forms/FileUpload";
import { Alert } from "./Alert";
import { PlayerPoster } from "./PlayerPoster";

export function PlayerPosterPanel({ player, onPhotoChange }) {
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function toggleEditor(open) {
    setEditing(open);
    setFile(null);
    setError("");
    setNotice("");
  }
  async function save(event) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      await appendImage(body,"playerPhoto",file,true);
      const { playerPhotoId } = await api("/player/photo", {
        method: "PUT",
        body,
      });
      onPhotoChange(playerPhotoId);
      toggleEditor(false);
      setNotice("Photo updated.");
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel poster-panel" aria-labelledby="poster-heading">
      <h2 id="poster-heading">Your participation poster</h2>
      <PlayerPoster
        player={player}
        previewFile={file}
        downloadable={!editing}
      />
      {editing ? (
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <FileUpload
              id="replacement-photo"
              label="New player photo"
              file={file}
              portrait
              onChange={(next, message) => {
                setFile(next);
                setError(message);
              }}
            />
            {error && <Alert>{error}</Alert>}
            <div className="poster-actions">
              <button className="button button-small" disabled={!file || busy}>
                {busy ? "Saving…" : "Save photo"}
              </button>
              <button
                className="inline-button"
                type="button"
                onClick={() => toggleEditor(false)}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <button
          type="button"
          className="inline-button poster-edit"
          onClick={() => toggleEditor(true)}
        >
          <Camera size={16} /> Change photo
        </button>
      )}
      {notice && (
        <p role="status" className="small-note">
          {notice}
        </p>
      )}
    </section>
  );
}
