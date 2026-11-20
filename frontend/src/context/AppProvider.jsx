import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { fallbackConfig } from "../config/tournament";
import { AppContext } from "./AppContext";

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [config, setConfig] = useState(fallbackConfig);
  const [configError, setConfigError] = useState("");
  const [configLoading, setConfigLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  async function refreshConfig() {
    setConfigLoading(true);
    try {
      setConfig(await api("/config"));
      setConfigError("");
    } catch (error) {
      setConfigError(error.message);
    } finally {
      setConfigLoading(false);
    }
  }
  async function refreshUser() {
    try {
      const next = await api("/auth/me");
      setUser(next);
      return next;
    } catch {
      setUser(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }
  async function logout() {
    setAuthError("");
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
    } catch {
      setAuthError("Sign out could not be completed. Please try again.");
    }
  }
  useEffect(() => {
    refreshConfig();
    refreshUser();
  }, []);
  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        authLoading,
        refreshUser,
        logout,
        config,
        configError,
        configLoading,
        authError,
        refreshConfig,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
