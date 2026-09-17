import { healthLabel, healthTone } from "@pfc/scoring";
import { Link } from "react-router";
import { Avatar } from "../components/Avatar.tsx";
import { Chip, ComingSoon, ErrorMessage, Kpi, Loading, PageHead } from "../components/ui.tsx";
import { toneColor } from "../lib/format.ts";
import { useFleetModel } from "../model/useFleetModel.ts";
import { useUi } from "../store/ui.ts";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export default function PersonasPage() {
  const { model, isLoading, error } = useFleetModel();
  const filter = useUi((s) => s.personaFilter);
  const set = useUi((s) => s.set);

  const chips = (
    <>
      <Chip on={filter === "all"} onClick={() => set({ personaFilter: "all" })}>
        All personas
      </Chip>
      <Chip on={filter === "risk"} onClick={() => set({ personaFilter: "risk" })}>
        Needs attention
      </Chip>
    </>
  );

  const shown = model?.filter((p) => (filter === "risk" ? p.health < 85 : true)) ?? [];

  return (
    <>
      <PageHead
        step="01 · WHO"
        title="Personas"
        sub="Seven personas, every device in the fleet, and the job titles that put people into them. Everything downstream starts here."
        tools={chips}
      />
      {error ? (
        <ErrorMessage error={error} />
      ) : isLoading || !model ? (
        <Loading />
      ) : (
        <>
          <div className="g4" style={{ marginBottom: 18 }}>
            <Kpi value={model.length} label="Personas" />
            <Kpi value={sum(model.map((p) => p.count))} label="Devices in estate" />
            <Kpi value={sum(model.map((p) => p.underCount))} label="Under baseline" tone="bad" />
            <Kpi value={sum(model.map((p) => p.openTickets))} label="Open tickets" tone="warn" />
          </div>

          <div className="personas" aria-label="Persona cards">
            {shown.map((p) => (
              <Link
                key={p.id}
                to={`/personas/${p.id}`}
                className="ring-card"
                style={{ textDecoration: "none", textAlign: "center" }}
              >
                <Avatar pid={p.id} size={40} color={p.hue} />
                <div className="ring-name" style={{ marginTop: 8 }}>
                  {p.name}
                </div>
                <div className="ring-sub">{p.sub}</div>
                <div className="ring-meta">
                  Health{" "}
                  <span className="m" style={{ color: toneColor(healthTone(p.health)) }}>
                    {Math.round(p.health)}
                  </span>{" "}
                  · {healthLabel(p.health)}
                </div>
              </Link>
            ))}
          </div>

          <ComingSoon step={6}>
            Persona health rings, the legend and the full mapping-confidence section (bands, donuts and review
            queue).
          </ComingSoon>
        </>
      )}
    </>
  );
}
