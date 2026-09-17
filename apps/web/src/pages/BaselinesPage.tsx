import { cpuTier } from "@pfc/scoring";
import { Link, useParams } from "react-router";
import { Avatar } from "../components/Avatar.tsx";
import { ComingSoon, ErrorMessage, Loading, PageHead, Panel } from "../components/ui.tsx";
import { gb } from "../lib/format.ts";
import { useFleetModel } from "../model/useFleetModel.ts";
import NotFoundPage from "./NotFoundPage.tsx";

export default function BaselinesPage() {
  const { pid } = useParams();
  const { model, isLoading, error } = useFleetModel();

  const head = (
    <PageHead
      step="02 · WHAT THEY GET"
      title="Baselines & device fit"
      sub="Where the fleet stands today, the contract behind it, and which component is missing. Move any slider and every number on this page re-grades."
    />
  );

  if (error)
    return (
      <>
        {head}
        <ErrorMessage error={error} />
      </>
    );
  if (isLoading || !model)
    return (
      <>
        {head}
        <Loading />
      </>
    );

  const focus = pid ?? model[0].id;
  const p = model.find((x) => x.id === focus);
  if (!p) return <NotFoundPage what={`Persona "${pid}"`} />;
  const b = p.baseline;

  return (
    <>
      {head}
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}
        aria-label="Choose persona"
      >
        {model.map((x) => (
          <Link
            key={x.id}
            to={`/baselines/${x.id}`}
            aria-current={x.id === focus ? "true" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 9,
              textDecoration: "none",
              background: x.id === focus ? "var(--hover)" : "var(--panel)",
              border: `1px solid ${x.id === focus ? "var(--accent)" : "var(--line)"}`,
              color: x.id === focus ? "var(--text)" : "var(--dim)",
            }}
          >
            <Avatar pid={x.id} size={20} color={x.hue} />
            <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>{x.name}</span>
          </Link>
        ))}
      </div>

      <Panel>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Baseline contract · {p.name}
        </div>
        <div className="m" style={{ fontSize: 13, color: "var(--dim)", lineHeight: 1.8 }}>
          {cpuTier(b.cpuScore)} (index {b.cpuScore}) · {b.ramGB}GB RAM · {gb(b.storageGB)} storage · boot ≤
          {b.bootSec}s · crashes ≤{b.crashes} · free disk ≥{b.freePct}% · battery ≥{b.batteryPct}% · tickets ≤
          {b.ticketsPer100} per 100 devices
        </div>
      </Panel>

      <ComingSoon step={8}>
        Fit tiles, contract sliders with live impact, fit donut and stacked bar, component match heat table,
        baseline reference and the app catalogue.
      </ComingSoon>
    </>
  );
}
