import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loading } from "../components/common/Loading";
import { Home } from "../pages/Home";

const Register = lazy(() =>
  import("../pages/Register").then((module) => ({ default: module.Register })),
);
const Login = lazy(() =>
  import("../pages/Login").then((module) => ({ default: module.Login })),
);
const Dashboard = lazy(() =>
  import("../pages/Dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);
const AdminPanel = lazy(() =>
  import("../pages/admin/AdminPanel").then((module) => ({
    default: module.AdminPanel,
  })),
);

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
