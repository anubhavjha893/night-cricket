import React, { useEffect, useState } from "react";
import { LayoutDashboard, Users, Settings2, ShieldCheck } from "lucide-react";

import { Loading } from "../../components/common/Loading";

import { useApp } from "../../hooks/useApp";

import { Login } from "../Login";
import { Players } from "../../components/admin/Players";
import { AdminSettings } from "../../components/admin/AdminSettings";
import { AdminOverview } from "../../components/admin/AdminOverview";

export function AdminPanel() {
  const { user, authLoading } = useApp();
  const [tab, setTab] = useState("overview");
  if (authLoading) return <Loading />;
  if (user?.role !== "admin") return <Login admin />;
  return (
    <section className="wrap admin-page page-space">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">ORGANISING DESK · SEASON 2</p>
          <h1 className="page-title">
            The player <em>line-up.</em>
          </h1>
          <p>Review the details. Verify the payment. Make the call.</p>
        </div>
        <span className="admin-identity">
          <ShieldCheck size={17} /> {user.email}
        </span>
      </div>
      <div className="admin-tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          <LayoutDashboard size={18} /> Overview
        </button>
        <button
          className={tab === "players" ? "active" : ""}
          onClick={() => setTab("players")}
        >
          <Users size={18} /> Player registrations
        </button>
        <button
          className={tab === "settings" ? "active" : ""}
          onClick={() => setTab("settings")}
        >
          <Settings2 size={18} /> Payment & settings
        </button>
      </div>
      {tab === "overview" ? (
        <AdminOverview />
      ) : tab === "players" ? (
        <Players />
      ) : (
        <AdminSettings />
      )}
    </section>
  );
}
