import React, { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { privatePhotoResponse } from "../../services/directUpload";
import {
  drawPoster,
  posterDetails,
  posterTemplate,
} from "../../utils/playerPoster";
import "../../styles/player-poster.css";

export function PlayerPoster({ player, previewFile, downloadable = false }) {
  const canvas = useRef(null);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  const { name, role, address } = posterDetails(player);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(20000),
    ]);
    let photoUrl;
    async function render() {
      setStatus("loading");
      const template = new Image();
      template.src = posterTemplate;
      let blob = previewFile;
      if (!blob) {
        const response = await privatePhotoResponse(player.playerPhotoId,signal);
        if (!response.ok) throw new Error("Photo unavailable");
        blob = await response.blob();
      }
      if (controller.signal.aborted) return;
      const photo = new Image();
      photoUrl = URL.createObjectURL(blob);
      photo.src = photoUrl;
      await Promise.all([template.decode(), photo.decode()]);
      if (controller.signal.aborted) return;
      drawPoster(canvas.current, template, photo, { name, role, address });
      setStatus("ready");
    }
    render()
      .catch(() => {
        if (!controller.signal.aborted) setStatus("failed");
      })
      .finally(() => {
        if (photoUrl) URL.revokeObjectURL(photoUrl);
      });
    return () => controller.abort();
  }, [player.playerPhotoId, previewFile, name, role, address, attempt]);

  function download() {
    canvas.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${player.registrationId}-player-poster.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }, "image/png");
  }
  return (
    <div className="player-poster">
      <canvas
        ref={canvas}
        width="1024"
        height="1536"
        role="img"
        aria-label={`${name}, ${role}, ${address}. Urmila Gupta Memorial Cricket Tournament, Season 2. Tenughat Golden Jubilee Ground.`}
        hidden={status !== "ready"}
      />
      {status !== "ready" && (
        <div className="poster-placeholder" role="status">
          {status === "failed"
            ? "Poster unavailable"
            : "Preparing your poster…"}
          {status === "failed" && downloadable && (
            <button
              className="inline-button"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {downloadable && status === "ready" && (
        <button
          type="button"
          className="button button-secondary button-small poster-download"
          onClick={download}
        >
          <Download size={16} /> Download poster
        </button>
      )}
    </div>
  );
}
