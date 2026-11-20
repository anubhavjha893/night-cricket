import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  IndianRupee,
  RefreshCw,
  RotateCcw,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "../../services/api";
import { Alert } from "../common/Alert";
import { Loading } from "../common/Loading";
import { formatDate } from "../../utils/formatDate";

const money = new Intl.NumberFormat("en-IN");

export function AdminOverview() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api("/admin/summary", { signal: controller.signal })
      .then((result) => {
        setSummary(result);
        setError("");
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setError(problem.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  if (!summary && loading)
    return <Loading>Loading registration overview…</Loading>;

  const cards = summary
    ? [
        { label: "Total registrations", value: summary.total, icon: Users },
        {
          label: "Pending review",
          value: summary.pending,
          icon: Clock3,
          type: "pending",
        },
        {
          label: "Approved",
          value: summary.approved,
          icon: CheckCircle2,
          type: "approved",
        },
        {
          label: "Rejected",
          value: summary.rejected,
          icon: XCircle,
          type: "rejected",
        },
        {
          label: "Approved collection",
          value: `₹${money.format(summary.approvedCollection)}`,
          icon: IndianRupee,
          type: "collection",
        },
        {
          label: "Approved after rejection",
          value: summary.reapprovedAfterRejection,
          icon: RotateCcw,
          type: "reapproved",
        },
      ]
    : [];

  return (
    <section className="admin-overview" aria-label="Registration overview">
      <div className="overview-heading">
        <div>
          <h2>Registration overview</h2>
          <p>Current application status and approved fee totals.</p>
        </div>
        <button
          className="button button-secondary"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
      {summary && (
        <>
          <div className="overview-stats">
            {cards.map(({ label, value, icon: Icon, type = "all" }) => (
              <article className={`stat-card ${type}`} key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <Icon size={22} />
              </article>
            ))}
          </div>
          <p className="small-note collection-note">
            Collection is calculated as ₹150 per currently approved player.
            Players approved after a rejection are counted once.
          </p>
          <div className="panel reapproval-panel">
            <div className="overview-heading">
              <div>
                <h2>
                  <RotateCcw size={20} /> Recent approvals after rejection
                </h2>
                <p>Corrected applications that were later approved.</p>
              </div>
              <span className="secondary-meta">
                Latest {summary.reapprovedPlayers.length} of{" "}
                {summary.reapprovedAfterRejection} total
              </span>
            </div>
            {summary.reapprovedPlayers.length ? (
              <ul className="reapproval-list">
                {summary.reapprovedPlayers.map((player) => (
                  <li key={player.registrationId}>
                    <div>
                      <strong>{player.name}</strong>
                      <small>{player.registrationId}</small>
                    </div>
                    <div>
                      <span>
                        Corrected submission #{player.submissionRevision || 1}
                      </span>
                      <small>{formatDate(player.reviewedAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small-note">
                No players have been approved after a rejection yet.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
