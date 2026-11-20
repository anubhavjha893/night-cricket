import React from "react";

export function Loading({ children = "Loading…" }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {children}
    </div>
  );
}
