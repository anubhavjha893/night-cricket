import React, { useEffect, useState } from 'react';
import { Camera, UploadCloud, Check, ImageOff } from 'lucide-react';
import { API_BASE } from './api';

export function Field({ label, error, hint, id, children, ...props }) {
  return <div className="field"><label htmlFor={id}>{label}{props.required && <span className="required"> *</span>}</label>{children || <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />}{hint && <small id={`${id}-hint`}>{hint}</small>}{error && <span className="field-error" id={`${id}-error`}>{Array.isArray(error) ? error[0] : error}</span>}</div>;
}

export function FileUpload({ label, file, onChange, error, id, portrait = false, optional = false }) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(event) {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { onChange(null, 'Choose a JPG, PNG or WebP image.'); event.target.value = ''; return; }
    if (next.size > 5 * 1024 * 1024) { onChange(null, 'The image must be 5 MB or smaller.'); event.target.value = ''; return; }
    onChange(next, '');
  }
  return <div className="field"><label htmlFor={id}>{label}{!optional && <span className="required"> *</span>}</label><label className={`file-upload ${file ? 'has-file' : ''} ${portrait ? 'portrait-upload' : ''}`} htmlFor={id}>
    <input className="file-input" id={id} type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} aria-describedby={`${id}-help`} />
    {preview ? <img className="upload-preview" src={preview} alt={`Selected ${label.toLowerCase()}`} /> : portrait ? <Camera size={32} /> : <UploadCloud size={32} />}
    <span><strong>{file ? file.name : 'Choose an image'}</strong><small>{file ? `${(file.size / 1024).toFixed(0)} KB · Click to replace` : 'JPG, PNG or WebP · Up to 5 MB'}</small></span>{file && <Check className="file-check" size={20} />}
  </label><small id={`${id}-help`}>{portrait ? 'Use a recent photograph with your face clearly visible.' : 'Make sure the amount, date and transaction reference are readable.'}</small>{error && <span className="field-error">{error}</span>}</div>;
}

export function PrivateImage({ id, alt, className = '' }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let objectUrl;
    setUrl(''); setFailed(false);
    fetch(`${API_BASE}/api/files/${id}`, { credentials: 'include', signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Image unavailable'); return response.blob();
    }).then(blob => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  if (failed) return <div className="image-placeholder"><ImageOff size={24} /> Image unavailable. Refresh to try again.</div>;
  if (!url) return <div className="image-placeholder">Loading image…</div>;
  return <a className={`private-image ${className}`} href={url} target="_blank" rel="noreferrer" aria-label={`Open ${alt.toLowerCase()} at full size`}><img src={url} alt={alt} /></a>;
}
