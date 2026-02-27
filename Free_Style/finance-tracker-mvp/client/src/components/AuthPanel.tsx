import { useState } from "react";
import type { AuthMode } from "../types";
import { authRequest } from "../api/auth";

export function AuthPanel({ onAuth }: { onAuth: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const { token } = await authRequest({ mode, email, password });
      localStorage.setItem("token", token); // ✅ so Dashboard import can use it
      onAuth(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel right authPanel">
      <div className="rightHeader authHeader">
        <div className="rightTitle">Authorization</div>

        <div className="toolbar authTabs">
          <button
            type="button"
            className={`chipBtn ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`chipBtn ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div>
          <div className="fieldLabel">Email</div>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div>
          <div className="fieldLabel">Password</div>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 6 chars"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        {error && <div className="authError">{error}</div>}

        <button
          className="btnPrimary"
          type="button"
          onClick={submit}
          disabled={loading}
        >
          {loading ? "..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </div>
    </div>
  );
}