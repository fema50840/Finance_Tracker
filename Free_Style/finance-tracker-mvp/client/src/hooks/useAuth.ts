import { useCallback, useMemo, useState } from "react";
import { createApiFetch } from "../api/client";

const TOKEN_KEY = "ft_token";

const getToken = () => localStorage.getItem(TOKEN_KEY);
const saveToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => getToken());

  const login = useCallback((t: string) => {
    saveToken(t);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    // ✅ важно: если уже разлогинены — ничего не делаем
    setToken((prev) => {
      if (prev === null) return prev;
      clearToken();
      return null;
    });
  }, []);

  const apiFetch = useMemo(() => {
    return createApiFetch({
      token,
      onUnauthorized: logout,
    });
  }, [token, logout]);

  return { token, login, logout, apiFetch };
}