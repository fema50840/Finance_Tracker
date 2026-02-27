import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./App.css";


import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import TransactionsPage from "./pages/TransactionsPage";
import DashboardPage from "./pages/DashboardPage";
import ChartsPage from "./pages/ChartsPage";

import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { token } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const isAuthRoute = location.pathname === "/auth";

    // ✅ authMode нужен только когда НЕТ токена и мы на /auth
    document.body.classList.toggle("authMode", !token && isAuthRoute);

    return () => {
      document.body.classList.remove("authMode");
    };
  }, [token, location.pathname]);

  return (
    <Routes>
      <Route
        path="/auth"
        element={token ? <Navigate to="/" replace /> : <AuthPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <TransactionsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/charts"
        element={
          <ProtectedRoute>
            <ChartsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={<Navigate to={token ? "/" : "/auth"} replace />}
      />
    </Routes>
  );
}