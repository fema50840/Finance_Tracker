import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";
import type { ExchangeRate } from "../types";
import { currencyMoney, money } from "../utils/format";

type Item = { category: string; amount: number };

type Row = {
  name: string;
  start: number; // offset
  value: number; // bar
  isTotal?: boolean;
};

function formatCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function TooltipCard(props: any) {
  const { active, payload, label, exchangeRate, privacyMode } = props as {
    active?: boolean;
    payload?: any[];
    label?: string;
    exchangeRate?: ExchangeRate | null;
    privacyMode?: boolean;
  };
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as Row | undefined;
  const value = Number(row?.value ?? 0);
  const eurValue = exchangeRate?.rate ? value / exchangeRate.rate : null;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        borderRadius: 14,
        padding: 12,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6, color: "#111827" }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: "rgba(17,24,39,0.65)" }}>
        RUB:{" "}
        <span className={`privateAmount ${privacyMode ? "hidden" : ""}`} style={{ fontWeight: 800, color: "#111827" }}>
          {currencyMoney(value, "RUB")}
        </span>
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: "rgba(17,24,39,0.65)" }}>
        EUR equivalent:{" "}
        <span className={`privateAmount ${privacyMode ? "hidden" : ""}`} style={{ fontWeight: 800, color: "#111827" }}>
          {eurValue === null ? "Loading..." : currencyMoney(eurValue, "EUR")}
        </span>
      </div>
    </div>
  );
}

export function WaterfallChart(props: {
  data: Item[];
  total: number;
  exchangeRate: ExchangeRate | null;
  privacyMode: boolean;
}) {
  const { data, total, exchangeRate, privacyMode } = props;

  const [activeName, setActiveName] = useState<string | null>(null);

  const rows: Row[] = useMemo(() => {
    const r: Row[] = [];
    let acc = 0;

    for (const item of data) {
      const v = Number(item.amount) || 0;
      r.push({ name: item.category, start: acc, value: v });
      acc += v;
    }

    r.push({
      name: "Total",
      start: 0,
      value: round2(Number(total) || 0),
      isTotal: true,
    });

    return r;
  }, [data, total]);

  const maxX = useMemo(() => {
    let m = 0;
    for (const row of rows) {
      m = Math.max(m, (row.start ?? 0) + (row.value ?? 0));
    }
    return m;
  }, [rows]);

  const renderValueLabel = (p: any) => {
    const { x, y, width, height, value, payload } = p;
    if (value == null) return null;

    const w = Number(width) || 0;
    const h = Number(height) || 0;
    const xx = Number(x) || 0;
    const yy = Number(y) || 0;

    const inside = w >= 56;
    const tx = inside ? xx + 12 : xx + w + 8;
    const ty = yy + h / 2 + 4;

    const isTotal = Boolean(payload?.isTotal);

    return (
      <text
        x={tx}
        y={ty}
        fill={inside ? "#ffffff" : "#111827"}
        fontSize={12}
        fontWeight={900}
        opacity={isTotal ? 0.95 : 1}
      >
        {privacyMode ? "•••" : formatCompact(Number(value))}
      </text>
    );
  };

  return (
      <div className="wfCard">
      <div className="wfTitle">Outcome breakdown</div>
      <div className="wfSub">
        Total:{" "}
        <span className={`privateAmount ${privacyMode ? "hidden" : ""}`}>
          {money(round2(total))}
        </span>
      </div>

      <div className="wfBody">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart
            layout="vertical"
            data={rows}
            margin={{ top: 8, right: 18, bottom: 8, left: 5 }}
            onMouseLeave={() => setActiveName(null)}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
                type="number"
                domain={[0, maxX || 0]}
                tick={{
                    fontSize: 11,
                    fill: "rgba(17,24,39,0.55)",
                    fontWeight: 500,
                }}
                tickFormatter={(value) => (privacyMode ? "•••" : money(Number(value)))}
                axisLine={{ stroke: "rgba(0,0,0,0.15)" }}
                tickLine={false}
                />

                <YAxis
                type="category"
                dataKey="name"
                width={95}
                tickMargin={8}
                tick={{
                    fontSize: 12,
                    fill: "rgba(17,24,39,0.75)",
                    fontWeight: 600,
                }}
                axisLine={false}
                tickLine={false}
                />

            <Tooltip content={<TooltipCard exchangeRate={exchangeRate} privacyMode={privacyMode} />} />

            {/* offset */}
            <Bar dataKey="start" stackId="wf" fill="transparent" isAnimationActive={false} />

            {/* bar */}
            <Bar
              dataKey="value"
              stackId="wf"
              radius={10}
              isAnimationActive
              animationDuration={450}
            >
              {rows.map((row) => {
                const isTotal = Boolean(row.isTotal);
                const isActive = !isTotal && activeName === row.name;

                const gray = "#CBD5E1";
                const blue = "#3B82F6";
                const totalColor = "#111827";

                // приглушаем все, кроме активного
                const dimOpacity = activeName ? 0.45 : 1;
                const opacity = isTotal ? 0.95 : isActive ? 1 : dimOpacity;

                const fill = isTotal ? totalColor : isActive ? blue : gray;

                return (
                    <Cell
                    key={row.name}
                    fill={fill}
                    opacity={opacity}
                    onMouseEnter={() => {
                        if (!isTotal) setActiveName(row.name);
                    }}
                    onMouseLeave={() => {
                        if (!isTotal) setActiveName(null);
                    }}
                    style={{ cursor: isTotal ? "default" : "pointer" }}
                    />
                );
                })}

              <LabelList dataKey="value" content={renderValueLabel} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
