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
    await api("/auth/logout").catch(() => {});
    setUser(null);
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
        refreshConfig,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
