import React from "react";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { AppRoutes } from "./routes/AppRoutes";
import { useApp } from "./hooks/useApp";
import { Alert } from "./components/common/Alert";

export function App() {
  const { authError } = useApp();
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        {authError && (
          <div className="wrap">
            <Alert>{authError}</Alert>
          </div>
        )}
        <AppRoutes />
      </main>
      <Footer />
    </>
  );
}
