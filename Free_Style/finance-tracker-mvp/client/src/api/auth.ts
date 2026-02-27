import { API } from "./client";
import type { AuthMode } from "../types";

export async function authRequest(params: {
  mode: AuthMode;
  email: string;
  password: string;
}): Promise<{ token: string }> {
  const { mode, email, password } = params;

  const res = await fetch(`${API}/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error ?? "Auth failed");
  }

  if (!data?.token) {
    throw new Error("No token returned");
  }

  return { token: data.token };
}