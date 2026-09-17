/* "How people were put into these personas": mapping confidence KPIs, bands,
   donuts and the review queue. Follows the wireframe's confidenceBlock. */
import type { ConfidenceBand, PersonaDef, PersonaId } from "@pfc/scoring";
import { useDeferredValue } from "react";
import { useMappingReview, useMappingSummary } from "../../api/queries.ts";
import type { KeyCount } from "../../api/types.ts";
import { Donut } from "../../charts/index.ts";
import { AnimNum } from "../../components/AnimNum.tsx";
import { Avatar } from "../../components/Avatar.tsx";
import { Icon } from "../../components/Icon.tsx";
import { LegendList } from "../../components/LegendList.tsx";
import { ChartType, Chip, ErrorMessage, Kpi, Loading, Panel, Sect } from "../../components/ui.tsx";
import { toneColor, type ToneOrAccent } from "../../lib/format.ts";
import { useUi } from "../../store/ui.ts";

const BANDS: ReadonlyArray<{ key: ConfidenceBand; title: string; sub: string; tone: ToneOrAccent }> = [
  { key: "100", title: "Confidence 100%", sub: "No review required", tone: "good" },
  { key: "50", title: "Confidence 50-99%", sub: "Review recommended", tone: "warn" },
  { key: "low", title: "Confidence <50%", sub: "Attention recommended", tone: "bad" },
];

export function MappingConfidence({ personas }: { personas: PersonaDef[] }) {
  const persona = useUi((s) => s.mappingPersona);
  const band = useUi((s) => s.mappingBand);
  const query = useUi((s) => s.mappingQuery);
  const set = useUi((s) => s.set);
  const deferredQuery = useDeferredValue(query);

  const summary = useMappingSummary(persona);
  const review = useMappingReview(persona, band, deferredQuery);

  const active = persona === "all" ? null : persona;
  const togglePersona = (id: PersonaId) => set({ mappingPersona: persona === id ? "all" : id });
  const toggleBand = (k: ConfidenceBand) => set({ mappingBand: band === k ? null : k });
  const def = (id: string) => personas.find((p) => p.id === id);
  const legendRows = (rows: KeyCount[]) =>
    rows.map((r) => ({
      key: r.k,
      label: def(r.k)?.name ?? r.k,
      n: r.n,
      color: def(r.k)?.hue ?? "var(--accent)",
    }));
  const donutRows = (rows: KeyCount[]) =>
    rows.map((r) => ({ key: r.k, n: r.n, color: def(r.k)?.hue ?? "#7C8CFF" }));

  return (
    <section aria-label="Mapping confidence">
      <Sect>How people were put into these personas</Sect>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, margin: "-2px 0 14px", flexWrap: "wrap" }}
      >
        <div style={{ fontSize: 12, color: "var(--dim)", maxWidth: 620, lineHeight: 1.5 }}>
          Every job title in the HR feed is mapped to one persona, and each mapping carries a confidence
          score. A weak mapping puts the wrong baseline on a real device.
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <label className="eyebrow" htmlFor="cpsel">
            Persona
          </label>
          <select
            id="cpsel"
            className="theme-sel"
            value={persona}
            onChange={(e) => set({ mappingPersona: e.target.value })}
          >
            <option value="all">All</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {band && (
            <Chip on onClick={() => set({ mappingBand: null })}>
              Clear band filter ✕
            </Chip>
          )}
        </div>
      </div>

      {summary.error ? (
        <ErrorMessage error={summary.error} />
      ) : !summary.data ? (
        <Loading />
      ) : (
        <>
          <div className="g3" style={{ marginBottom: 16 }}>
            <Kpi value={summary.data.avgConfidence} dec={2} label="Avg confidence %" tone="accent" />
            <Kpi value={summary.data.distinctTitles} label="Distinct job titles" />
            <Kpi value={summary.data.titlesMapped} label="Titles mapped in scope" />
          </div>

          <div className="g3" style={{ marginBottom: 16 }} role="group" aria-label="Confidence bands">
            {BANDS.map((b) => {
              const on = band === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  className="statbox"
                  aria-pressed={on}
                  onClick={() => toggleBand(b.key)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    width: "100%",
                    borderColor: on ? toneColor(b.tone) : "var(--line)",
                    background: on ? "var(--hover)" : "var(--panel)",
                  }}
                >
                  <div className="eyebrow" style={{ marginBottom: 8 }}>
                    {b.title}
                  </div>
                  <div className="stat-v" style={{ color: toneColor(b.tone) }}>
                    <AnimNum value={summary.data.bands[b.key]} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 7 }}>{b.sub}</div>
                </button>
              );
            })}
          </div>

          <div className="g2">
            {(
              [
                ["Count of job title by persona", "TITLES", summary.data.byPersona],
                ["Count of department by persona", "DEPTS", summary.data.byDept],
              ] as const
            ).map(([title, center, rows]) => (
              <Panel key={center}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  {title}
                  <ChartType name="DONUT" />
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ width: 190, flexShrink: 0 }}>
                    <Donut
                      rows={donutRows(rows)}
                      centerLabel={center}
                      active={active}
                      onSelect={togglePersona}
                      label={title}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 210 }}>
                    <LegendList
                      rows={legendRows(rows)}
                      active={active}
                      onSelect={togglePersona}
                      label={`${title} legend`}
                    />
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </>
      )}

      <Sect>{band ? "Job titles in the selected band" : "Job titles worth a second look"}</Sect>
      <Panel pad={0}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
            Lowest confidence first · first 150 rows
            {review.data && review.data.matched > review.data.rows.length
              ? ` of ${review.data.matched.toLocaleString()}`
              : ""}
          </div>
          <div className="search" style={{ marginLeft: "auto" }}>
            <Icon name="search" size={13} color="var(--faint)" />
            <input
              id="csearch"
              aria-label="Search job title or department"
              placeholder="job title or department"
              value={query}
              onChange={(e) => set({ mappingQuery: e.target.value })}
            />
          </div>
        </div>
        <div className="tscroll">
          <table aria-label="Job titles to review">
            <thead>
              <tr>
                <th className="l">Job title</th>
                <th className="l">Department</th>
                <th className="l">Mapped persona</th>
                <th>Confidence</th>
                <th className="l">Why it was flagged</th>
              </tr>
            </thead>
            <tbody>
              {review.error ? (
                <tr>
                  <td colSpan={5} className="l" style={{ padding: 26, color: "var(--bad)" }}>
                    Could not load the review queue: {review.error.message}
                  </td>
                </tr>
              ) : !review.data ? (
                <tr>
                  <td colSpan={5} className="l" style={{ padding: 26, color: "var(--faint)" }}>
                    Loading…
                  </td>
                </tr>
              ) : review.data.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="l" style={{ padding: 26, color: "var(--faint)" }}>
                    Nothing to review in this selection.
                  </td>
                </tr>
              ) : (
                review.data.rows.map((r, i) => {
                  const p = def(r.pid);
                  const tone: ToneOrAccent = r.conf >= 100 ? "good" : r.conf >= 50 ? "warn" : "bad";
                  return (
                    <tr
                      key={`${r.pid}-${r.t}-${r.dept}-${i}`}
                      tabIndex={0}
                      title={`Filter to ${p?.name ?? r.pid}`}
                      onClick={() => togglePersona(r.pid)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") togglePersona(r.pid);
                      }}
                    >
                      <td className="l">{r.t}</td>
                      <td className="l" style={{ color: "var(--dim)" }}>
                        {r.dept}
                      </td>
                      <td className="l">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <Avatar pid={r.pid} size={20} color={p?.hue} />
                          {p?.name ?? r.pid}
                        </span>
                      </td>
                      <td className="m" style={{ color: toneColor(tone) }}>
                        {r.conf}%
                      </td>
                      <td className="l" style={{ color: "var(--faint)" }}>
                        {r.why || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--faint)" }}>
        Click a confidence band to filter the list. 100% titles need no review; anything under 50% should be
        re-mapped before it drives a baseline.
      </div>
    </section>
  );
}
