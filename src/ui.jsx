import React, { createContext, useContext } from 'react';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
export const formatDate = value => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
export function Alert({ children, tone = 'error' }) {
  return <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}
export function Loading({ children = 'Loading…' }) { return <div className="loading" role="status"><span className="spinner" />{children}</div>; }
export function StatusBadge({ status }) { return <span className={`status-badge ${status}`}>{status === 'pending' ? 'Pending verification' : status === 'approved' ? 'Approved' : 'Rejected'}</span>; }
