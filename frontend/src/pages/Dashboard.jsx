import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  Clock3,
  XCircle,
  RefreshCw,
  UserRound,
  CalendarDays,
  Inbox,
} from "lucide-react";
import { api } from "../services/api";
import { Alert } from "../components/common/Alert";
import { formatDate } from "../utils/formatDate";
import { Loading } from "../components/common/Loading";
import { StatusBadge } from "../components/common/StatusBadge";
import { useApp } from "../hooks/useApp";

import { PrivateImage } from "../components/common/PrivateImage";

export function Dashboard() {
  const { user, authLoading } = useApp();
  const [player, setPlayer] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  async function load() {
    setRefreshing(true);
    try {
      setPlayer(await api("/player/me"));
      setError("");
    } catch (error) {
      setError(error.message);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    if (user?.role !== "player") return;
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    return () => clearInterval(interval);
  }, [user?.role]);
  async function markRead() {
    setMarking(true);
    try {
      await api("/player/notifications/read", { method: "POST" });
      await load();
    } catch (error) {
      setError(error.message);
    } finally {
      setMarking(false);
    }
  }
  if (authLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  const unread =
    player?.notifications.filter((notification) => !notification.readAt)
      .length || 0;
  const approved = player?.status === "approved";
  const rejected = player?.status === "rejected";
  const StatusIcon = approved ? CheckCircle2 : rejected ? XCircle : Clock3;
  return (
    <section className="wrap dashboard page-space">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">PLAYER DASHBOARD · SEASON 2</p>
          <h1 className="page-title">
            Hello,{" "}
            <em>{player?.name?.split(" ")[0] || user.name?.split(" ")[0]}.</em>
          </h1>
          <p>Your application. Your updates. Your next innings.</p>
        </div>
        <button
          className="button button-secondary"
          onClick={load}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} /> Refresh
          status
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
      {!player ? (
        <Loading>Loading your registration…</Loading>
      ) : (
        <>
          <div className={`status-hero ${player.status}`}>
            <span className="status-hero-icon">
              <StatusIcon size={34} />
            </span>
            <div>
              <StatusBadge status={player.status} />
              <h2>
                {approved
                  ? "You’re verified. Get ready."
                  : rejected
                    ? "Your application needs attention."
                    : "You’re registered. Review is next."}
              </h2>
              <p>
                {approved
                  ? "Congratulations! Your details and payment have been verified. We will inform you soon about the auction dates."
                  : rejected
                    ? player.rejectionReason
                    : "Your player details and payment proof have reached the organising team. We’ll post the verification result right here."}
              </p>
            </div>
            <span className="registration-id">{player.registrationId}</span>
          </div>
          {rejected && (
            <div className="panel correction-callout">
              <h2>Correct your application</h2>
              <p>
                Review the rejection reason above, correct your details or
                replace the payment screenshot, then resubmit for verification.
                Your registration ID stays the same.
              </p>
              <Link className="button" to="/register?correct=1">
                Correct & resubmit
              </Link>
            </div>
          )}
          <div className="player-dashboard-grid">
            <div>
              <div className="panel">
                <div className="panel-heading">
                  <h2>
                    <UserRound size={20} /> Your player profile
                  </h2>
                  <span className="secondary-meta">
                    Submitted {formatDate(player.createdAt)}
                  </span>
                </div>
                <div className="player-profile">
                  <PrivateImage
                    id={player.playerPhotoId}
                    alt="Player photograph"
                    className="profile-photo"
                  />
                  <dl className="detail-grid">
                    <div>
                      <dt>Full name</dt>
                      <dd>{player.name}</dd>
                    </div>
                    <div>
                      <dt>Mobile number</dt>
                      <dd>{player.phone}</dd>
                    </div>
                    <div>
                      <dt>Age</dt>
                      <dd>{player.age} years</dd>
                    </div>
                    <div>
                      <dt>Playing role</dt>
                      <dd>{player.roles.join(", ")}</dd>
                    </div>
                    <div>
                      <dt>T-shirt size</dt>
                      <dd>{player.tshirtSize}</dd>
                    </div>
                    <div>
                      <dt>Registration fee</dt>
                      <dd>₹{player.paymentAmount}</dd>
                    </div>
                    <div className="span-2">
                      <dt>Address</dt>
                      <dd>{player.address}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="panel journey-panel">
                <h2>
                  <CalendarDays size={20} /> Your journey to the field
                </h2>
                <div className="journey">
                  <div className="done">
                    <CheckCircle2 size={22} />
                    <span>
                      <strong>Application submitted</strong>
                      <small>
                        Your registration and payment proof were received.
                      </small>
                    </span>
                  </div>
                  <div
                    className={
                      approved ? "done" : rejected ? "failed" : "current"
                    }
                  >
                    <StatusIcon size={22} />
                    <span>
                      <strong>
                        {approved
                          ? "Details & payment verified"
                          : rejected
                            ? "Application rejected"
                            : "Verification in progress"}
                      </strong>
                      <small>
                        {player.reviewedAt
                          ? formatDate(player.reviewedAt)
                          : "The organising team will review your application."}
                      </small>
                    </span>
                  </div>
                  <div>
                    <CalendarDays size={22} />
                    <span>
                      <strong>Auction announcement</strong>
                      <small>
                        {rejected
                          ? "Participation is subject to approval by the organisers."
                          : "Dates will be announced by the organisers."}
                      </small>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <aside className="panel notifications-panel">
              <div className="panel-heading">
                <h2>
                  <Bell size={20} /> Notifications{" "}
                  {unread > 0 && (
                    <span className="notification-count">{unread}</span>
                  )}
                </h2>
                {unread > 0 && (
                  <button
                    className="inline-button"
                    onClick={markRead}
                    disabled={marking}
                  >
                    {marking ? "Saving…" : "Mark all read"}
                  </button>
                )}
              </div>
              <p className="small-note">
                Updates appear here when the organising team reviews your
                registration. This page refreshes automatically while open.
              </p>
              <div className="notification-list">
                {[...player.notifications].reverse().map((notification) => (
                  <article
                    key={notification._id}
                    className={`notification ${notification.readAt ? "" : "unread"}`}
                  >
                    <span className={`notification-icon ${notification.kind}`}>
                      {notification.kind === "approved" ? (
                        <CheckCircle2 size={19} />
                      ) : notification.kind === "rejected" ? (
                        <XCircle size={19} />
                      ) : (
                        <Inbox size={19} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {notification.kind === "approved"
                          ? "Registration approved"
                          : notification.kind === "rejected"
                            ? "Registration rejected"
                            : "Application received"}
                      </strong>
                      <p>{notification.message}</p>
                      <time dateTime={notification.createdAt}>
                        {formatDate(notification.createdAt)}
                      </time>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
