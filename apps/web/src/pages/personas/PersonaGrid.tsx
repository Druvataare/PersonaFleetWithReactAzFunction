import type { PersonaModel } from "@pfc/scoring";
import { Link } from "react-router";
import { PersonaRing } from "../../charts/index.ts";
import { ChartType } from "../../components/ui.tsx";

/** One radial health ring per persona; each card opens the persona page. */
export function PersonaGrid({ personas }: { personas: PersonaModel[] }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="eyebrow">
          Persona health
          <ChartType name="RADIAL GAUGE GRID" />
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--faint)" }}>
          Click any persona for its full page
        </span>
      </div>

      <div className="personas" aria-label="Persona cards">
        {personas.map((p) => (
          <Link key={p.id} to={`/personas/${p.id}`} className="ring-card" style={{ textDecoration: "none" }}>
            <PersonaRing pid={p.id} health={p.health} underPct={p.underPct} />
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <div className="ring-name">{p.name}</div>
              <div className="ring-sub">{p.sub}</div>
              <div className="ring-meta">
                <span className="m" style={{ color: "var(--dim)" }}>
                  {p.count.toLocaleString()}
                </span>{" "}
                devices ·{" "}
                <span className="m" style={{ color: "var(--bad)" }}>
                  {Math.round(p.underPct * 100)}%
                </span>{" "}
                below baseline
                <br />
                <span className="m" style={{ color: "var(--warn)" }}>
                  {p.openTickets.toLocaleString()}
                </span>{" "}
                open tickets
              </div>
            </div>
          </Link>
        ))}
      </div>
      {personas.length === 0 && (
        <div className="state-msg">No personas need attention: every persona scores 85 or above.</div>
      )}

      <div
        style={{
          marginTop: 22,
          display: "flex",
          gap: 18,
          alignItems: "center",
          color: "var(--faint)",
          fontSize: 11,
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="dot" style={{ background: "var(--good)" }} />
          Outer ring — persona health
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <i className="dot" style={{ background: "var(--bad)" }} />
          Inner ring — share below baseline
        </span>
      </div>
    </>
  );
}
