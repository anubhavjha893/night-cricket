import React, { useEffect, useState } from "react";
import { Camera, UploadCloud, Check } from "lucide-react";

export function FileUpload({
  label,
  file,
  onChange,
  error,
  id,
  portrait = false,
  optional = false,
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(event) {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      onChange(null, "Choose a JPG, PNG or WebP image.");
      event.target.value = "";
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      onChange(null, "The image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    onChange(next, "");
  }
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {!optional && <span className="required"> *</span>}
      </label>
      <label
        className={`file-upload ${file ? "has-file" : ""} ${portrait ? "portrait-upload" : ""}`}
        htmlFor={id}
      >
        <input
          className="file-input"
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={choose}
          aria-describedby={`${id}-help`}
        />
        {preview ? (
          <img
            className="upload-preview"
            src={preview}
            alt={`Selected ${label.toLowerCase()}`}
          />
        ) : portrait ? (
          <Camera size={32} />
        ) : (
          <UploadCloud size={32} />
        )}
        <span>
          <strong>{file ? file.name : "Choose an image"}</strong>
          <small>
            {file
              ? `${(file.size / 1024).toFixed(0)} KB · Click to replace`
              : "JPG, PNG or WebP · Up to 5 MB"}
          </small>
        </span>
        {file && <Check className="file-check" size={20} />}
      </label>
      <small id={`${id}-help`}>
        {portrait
          ? "Use a recent photograph with your face clearly visible."
          : "Make sure the amount, date and transaction reference are readable."}
      </small>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
