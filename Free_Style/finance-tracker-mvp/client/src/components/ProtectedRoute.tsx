import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    // ✅ важно: редиректим, а не возвращаем null
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}