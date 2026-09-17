/* Donut legend: colour dot, label, count and share. Rows act as filter buttons. */

export interface LegendRow {
  key: string;
  label: string;
  n: number;
  color: string;
}

interface LegendListProps {
  rows: LegendRow[];
  active?: string | null;
  onSelect?: (key: string) => void;
  /** Decimal places for the percentage column (2 on Personas, 1 on Tickets). */
  pctDecimals?: number;
  label?: string;
}

export function LegendList({ rows, active = null, onSelect, pctDecimals = 2, label }: LegendListProps) {
  const total = rows.reduce((a, r) => a + r.n, 0) || 1;
  return (
    <div role="group" aria-label={label}>
      {rows.map((r) => (
        <button
          key={r.key}
          type="button"
          aria-pressed={active === r.key}
          onClick={() => onSelect?.(r.key)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: onSelect ? "pointer" : "default",
            padding: "4px 0",
            width: "100%",
            opacity: !active || active === r.key ? 1 : 0.4,
          }}
        >
          <i className="dot" style={{ background: r.color }} />
          <span className="truncate" style={{ fontSize: 11.5, color: "var(--dim)" }}>
            {r.label}
          </span>
          <span className="m" style={{ fontSize: 11.5, color: "var(--text)", marginLeft: "auto" }}>
            {r.n.toLocaleString()}
          </span>
          <span
            className="m"
            style={{
              fontSize: 10.5,
              color: "var(--faint)",
              width: pctDecimals > 1 ? 46 : 48,
              textAlign: "right",
            }}
          >
            {((r.n / total) * 100).toFixed(pctDecimals)}%
          </span>
        </button>
      ))}
    </div>
  );
}
