import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import { useApp } from "../../hooks/useApp";

const warmLogin = () => import("../../pages/Login").catch(() => {});

const warmRegister = () => import("../../pages/Register").catch(() => {});

export function Header() {
  const { user, logout } = useApp();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <header className="header wrap">
      <Link className="brand" to="/">
        <span className="brand-icon" aria-hidden="true">
          U<span>G</span>M
        </span>
        <span>
          URMILA GUPTA MEMORIAL<small>CRICKET TOURNAMENT · SEASON 2</small>
        </span>
      </Link>
      <nav className={menu ? "nav-open" : ""} aria-label="Main navigation">
        <Link to="/">The tournament</Link>
        <Link to={user?.role === "admin" ? "/admin" : "/dashboard"}>
          {user?.role === "admin" ? "Admin panel" : "Track registration"}
        </Link>
        {user ? (
          <button className="nav-logout" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        ) : (
          <Link
            onPointerEnter={warmLogin}
            onFocus={warmLogin}
            onTouchStart={warmLogin}
            to="/login"
          >
            Player sign in
          </Link>
        )}
      </nav>
      <Link
        className="button button-small header-cta"
        onPointerEnter={warmRegister}
        onFocus={warmRegister}
        onTouchStart={warmRegister}
        to="/register"
      >
        Player registration
      </Link>
      <button
        className="icon-button mobile-menu"
        onClick={() => setMenu((v) => !v)}
        aria-label={menu ? "Close navigation" : "Open navigation"}
        aria-expanded={menu}
      >
        {menu ? <X /> : <Menu />}
      </button>
    </header>
  );
}
