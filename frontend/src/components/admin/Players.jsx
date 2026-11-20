import React, { useCallback, useEffect, useState } from "react";
import {
  Users,
  Clock3,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";
import { api } from "../../services/api";
import { Alert } from "../../components/common/Alert";

import { Loading } from "../../components/common/Loading";
import { StatusBadge } from "../../components/common/StatusBadge";

import { PlayerReview } from "./PlayerReview";
import { WhatsAppMessageDialog } from "./WhatsAppMessageDialog";

export function Players() {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [whatsappContact, setWhatsappContact] = useState(null);
  const closeWhatsApp = useCallback(() => setWhatsappContact(null), []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          status,
          search,
          page: String(page),
        });
        setResult(
          await api(`/admin/players?${query}`, { signal: controller.signal }),
        );
        setError("");
      } catch (error) {
        if (error.name !== "AbortError") setError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [status, search, page, refreshKey]);
  const counts = result?.counts || {};
  return (
    <>
      <div className="admin-stats">
        {[
          {
            label: "Total players",
            number: Object.values(counts).reduce((a, b) => a + b, 0),
            icon: Users,
            type: "all",
          },
          {
            label: "Pending review",
            number: counts.pending || 0,
            icon: Clock3,
            type: "pending",
          },
          {
            label: "Approved",
            number: counts.approved || 0,
            icon: CheckCircle2,
            type: "approved",
          },
          {
            label: "Rejected",
            number: counts.rejected || 0,
            icon: XCircle,
            type: "rejected",
          },
        ].map((item) => (
          <button
            className={`stat-card ${item.type}`}
            onClick={() => {
              setStatus(item.type === "all" ? "" : item.type);
              setPage(1);
            }}
            key={item.type}
          >
            <item.icon size={22} />
            <span>{item.label}</span>
            <strong>{item.number}</strong>
          </button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      <div className={`admin-workspace ${selected ? "has-selection" : ""}`}>
        <div className="panel player-list-panel">
          <div className="list-toolbar">
            <div className="search-field">
              <Search size={18} />
              <input
                type="search"
                aria-label="Search players"
                placeholder="Search name, phone or registration ID"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              aria-label="Filter registrations by status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All players</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              className="icon-button"
              aria-label="Refresh player list"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          <div className="list-caption">
            <span>PLAYERS · SORTED BY NAME</span>
            <span>{result?.total || 0} results</span>
          </div>
          {loading ? (
            <Loading>Loading players…</Loading>
          ) : result?.players.length ? (
            <div className="player-list">
              {result.players.map((player) => (
                <div
                  className={`player-row ${selected === player._id ? "selected" : ""}`}
                  onClick={() => setSelected(player._id)}
                  key={player._id}
                >
                  <span className="player-avatar">
                    {player.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")}
                  </span>
                  <div className="player-row-name">
                    <button
                      type="button"
                      className="player-select-button"
                      onClick={() => setSelected(player._id)}
                    >
                      <strong>{player.name}</strong>
                    </button>
                    <div className="player-contact-line">
                      <small>{player.phone}</small>
                      <button
                        type="button"
                        className="whatsapp-row-button"
                        aria-label={`Send WhatsApp message to ${player.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setWhatsappContact({ player });
                        }}
                      >
                        <MessageCircle size={15} /> WhatsApp
                      </button>
                    </div>
                    <small>{player.roles.join(" / ")}</small>
                    <small className="registration-ref">
                      {player.registrationId}
                    </small>
                  </div>
                  <StatusBadge status={player.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Users size={36} />
              <h3>No players found</h3>
              <p>
                {search
                  ? "Try a different name or mobile number."
                  : "Applications matching this filter will appear here."}
              </p>
            </div>
          )}
          <div className="pagination">
            <span>
              Page {page} of {Math.max(1, result?.pages || 1)}
            </span>
            <div>
              <button
                className="button button-secondary button-small"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <button
                className="button button-secondary button-small"
                disabled={page >= (result?.pages || 1) || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
        {selected ? (
          <PlayerReview
            id={selected}
            onClose={() => setSelected("")}
            onDecision={(decision) => {
              setRefreshKey((value) => value + 1);
              if (decision?.player) setWhatsappContact(decision);
            }}
            onWhatsApp={(player) => setWhatsappContact({ player })}
          />
        ) : (
          <div className="panel select-player">
            <ShieldCheck size={42} />
            <h2>A fair review starts here.</h2>
            <p>
              Select a player to see their full application, photograph and
              payment proof.
            </p>
          </div>
        )}
      </div>
      {whatsappContact && (
        <WhatsAppMessageDialog
          key={`${whatsappContact.player._id}:${whatsappContact.status || "choice"}`}
          contact={whatsappContact}
          onClose={closeWhatsApp}
        />
      )}
    </>
  );
}
