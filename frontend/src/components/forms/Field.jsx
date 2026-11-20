import React from "react";

export function Field({ label, error, hint, id, children, ...props }) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && <span className="required"> *</span>}
      </label>
      {children || (
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          {...props}
        />
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {Array.isArray(error) ? error[0] : error}
        </span>
      )}
    </div>
  );
}
