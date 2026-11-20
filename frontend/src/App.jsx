import React from "react";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { AppRoutes } from "./routes/AppRoutes";

export function App() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <AppRoutes />
      </main>
      <Footer />
    </>
  );
}
