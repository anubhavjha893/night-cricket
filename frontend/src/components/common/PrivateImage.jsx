import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { privatePhotoResponse } from "../../services/directUpload";

export function PrivateImage({ id, alt, className = "" }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    setUrl("");
    setFailed(false);
    privatePhotoResponse(id, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
      .then((response) => {
        if (!response.ok) throw new Error("Image unavailable");
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setFailed(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (failed)
    return (
      <div className="image-placeholder">
        <ImageOff size={24} /> Image unavailable. Refresh to try again.
      </div>
    );
  if (!url) return <div className="image-placeholder">Loading image…</div>;
  return (
    <a
      className={`private-image ${className}`}
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${alt.toLowerCase()} at full size`}
    >
      <img src={url} alt={alt} />
    </a>
  );
}
