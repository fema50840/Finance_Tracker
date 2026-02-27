// src/pages/ChartsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { useAuth } from "../hooks/useAuth";
import { todayISO, money } from "../utils/format";

type Point = { date: string; balance: number; delta: number };
type PeriodPreset = "month" | "30d" | "all" | "custom";

function addDaysISO(baseIso: string, delta: number) {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function firstDayOfCurrentMonthISO() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function ChartsPage() {
  const { apiFetch, logout } = useAuth();
  const navigate = useNavigate();

  const [periodPreset, setPeriodPresetRaw] = useState<PeriodPreset>("30d");
  const [from, setFrom] = useState(() => addDaysISO(todayISO(), -29));
  const [to, setTo] = useState(() => todayISO());

  const [range, setRange] = useState<{ min: string; max: string } | null>(null);

  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ preset setter без хуков внутри
  const setPeriodPreset = (preset: PeriodPreset) => {
    setPeriodPresetRaw(preset);
    const today = todayISO();

    if (preset === "month") {
      setFrom(firstDayOfCurrentMonthISO());
      setTo(today);
      return;
    }

    if (preset === "30d") {
      setFrom(addDaysISO(today, -29));
      setTo(today);
      return;
    }

    if (preset === "all") {
      // если range уже есть — ставим сразу, если нет — временно 30d
      if (range) {
        setFrom(range.min);
        setTo(range.max);
      } else {
        setFrom(addDaysISO(today, -29));
        setTo(today);
      }
      return;
    }

    // custom — ничего не трогаем
  };

  // ✅ загрузка границ "all time"
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/transactions-range");
        if (r.ok) setRange(await r.json());
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ если пользователь выбрал "all", но range пришел позже — обновляем from/to
  useEffect(() => {
    if (periodPreset !== "all") return;
    if (!range) return;

    setFrom(range.min);
    setTo(range.max);
  }, [periodPreset, range]);

  // ✅ загрузка series
  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/balance-series?from=${from}&to=${to}`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(err.error ?? "Failed to load series");
        return;
      }
      const json = await r.json();
      setData(json);
    } catch (e) {
      console.error(e);
      logout();
      navigate("/auth", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const lastBalance = useMemo(() => {
    const last = data[data.length - 1];
    return last ? last.balance : 0;
  }, [data]);

  return (
    <div className="app">
      <div className="container">
        <div className="topRow">
          <h1 className="hi topTitle">Cashflow</h1>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="chipBtn"
              type="button"
              onClick={() => navigate("/")}
            >
              ← Back
            </button>
          </div>
        </div>

        <div className="panel right" style={{ marginTop: 16 }}>
          <div className="rightHeader">
            <div className="rightTitle">Balance over time</div>
            <div style={{ fontWeight: 900 }}>
              {loading ? "Loading..." : `Last: ${money(lastBalance)}`}
            </div>
          </div>

          {/* период-фильтр */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              className={`chipBtn ${periodPreset === "month" ? "active" : ""}`}
              onClick={() => setPeriodPreset("month")}
            >
              Current month
            </button>

            <button
              type="button"
              className={`chipBtn ${periodPreset === "30d" ? "active" : ""}`}
              onClick={() => setPeriodPreset("30d")}
            >
              Last 30 days
            </button>

            <button
              type="button"
              className={`chipBtn ${periodPreset === "all" ? "active" : ""}`}
              onClick={() => setPeriodPreset("all")}
            >
              All time
            </button>

            <button
              type="button"
              className={`chipBtn ${periodPreset === "custom" ? "active" : ""}`}
              onClick={() => setPeriodPresetRaw("custom")}
            >
              Custom
            </button>

            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div>
                <div className="fieldLabel">From</div>
                <input
                  className="input"
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setPeriodPresetRaw("custom");
                    setFrom(e.target.value);
                  }}
                />
              </div>

              <div>
                <div className="fieldLabel">To</div>
                <input
                  className="input"
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setPeriodPresetRaw("custom");
                    setTo(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>

          {/* график */}
          <div style={{ marginTop: 14, height: 400, minHeight: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 10, right: 18, bottom: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "rgba(17,24,39,0.55)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "rgba(17,24,39,0.55)" }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: any) => money(Number(v))}
                  labelFormatter={(l) => `Date: ${l}`}
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.08)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  }}
                />
                <Line type="monotone" dataKey="balance" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}