import React from "react";

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge ${status}`}>
      {status === "pending"
        ? "Pending verification"
        : status === "approved"
          ? "Approved"
          : "Rejected"}
    </span>
  );
}
