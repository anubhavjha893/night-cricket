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
  const [sessionError, setSessionError] = useState("");
  const [startupComplete, setStartupComplete] = useState(false);
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
      setSessionError("");
      return next;
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
        setSessionError("");
      } else setSessionError(error.message);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }
  async function retryConnection() {
    setAuthLoading(true);
    await Promise.all([refreshConfig(), refreshUser()]);
  }
  useEffect(() => {
    if (!authLoading && !configLoading && !configError && !sessionError)
      setStartupComplete(true);
  }, [authLoading, configLoading, configError, sessionError]);
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
        startupComplete,
        startupError: configError || sessionError,
        retryConnection,
        refreshConfig,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
