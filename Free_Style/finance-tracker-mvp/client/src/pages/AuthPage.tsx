import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthPanel} from "../components/AuthPanel";
import { useAuth } from "../hooks/useAuth";

export default function AuthPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();

  // если уже залогинен — на главную
  useEffect(() => {
    if (token) navigate("/", { replace: true });
  }, [token, navigate]);

  return (
    <div className="app authPage">
      <div className="container authInner">
        <h1 className="hi">FinanceTracker</h1>
        <AuthPanel
          onAuth={(t) => {
            login(t);
            navigate("/", { replace: true });
          }}
        />
      </div>
    </div>
  );
}