/* Persona page: everything about one persona, following the wireframe's screenPersona. */
import { useParams } from "react-router";
import { useCatalog, useMigrations } from "../api/queries.ts";
import { ErrorMessage, Kpi, Loading } from "../components/ui.tsx";
import { useFleetModel } from "../model/useFleetModel.ts";
import { Replay } from "../motion/clock.tsx";
import { useUi } from "../store/ui.ts";
import NotFoundPage from "./NotFoundPage.tsx";
import { DeviceTable } from "./persona/DeviceTable.tsx";
import {
  ExperienceCompliance,
  HealthComposition,
  IdentityBand,
  MovementExceptions,
  Provisioning,
  SupportLoad,
} from "./persona/sections.tsx";

export default function PersonaDetailPage() {
  const { pid } = useParams();
  const { model, isLoading, error } = useFleetModel();
  const catalog = useCatalog();
  const migrations = useMigrations();
  const filterPersona = useUi((s) => s.deviceFilterPersona);
  const storedCat = useUi((s) => s.ticketCategory);
  const storedQuery = useUi((s) => s.deviceQuery);
  const set = useUi((s) => s.set);

  /* Filters belong to one persona: opening another persona starts clean. */
  const cat = filterPersona === pid ? storedCat : null;
  const query = filterPersona === pid ? storedQuery : "";

  const loadError = error ?? catalog.error ?? migrations.error;
  if (loadError) return <ErrorMessage error={loadError} />;
  if (isLoading || !model || !catalog.data || !migrations.data) return <Loading />;
  const p = model.find((x) => x.id === pid);
  if (!p) return <NotFoundPage what={`Persona "${pid}"`} />;

  const b = p.baseline;
  const net = p.movedIn - p.movedOut;

  return (
    /* Like the wireframe, charts replay when the ticket filter changes; typing in search does not. */
    <Replay on={[p.id, cat]}>
      <IdentityBand p={p} />

      <div className="g4" style={{ marginBottom: 16 }}>
        <Kpi value={p.count} label="Devices" />
        <Kpi value={p.underCount} label="Below baseline" tone="bad" />
        <Kpi value={p.openTickets} label="Open tickets" tone="warn" />
        <Kpi value={p.ticketsPer100} dec={1} label="Tickets / 100" />
        <Kpi
          value={Math.round(p.avgBoot)}
          suf="s"
          label="Average boot"
          tone={p.avgBoot > b.bootSec ? "warn" : "good"}
        />
        <Kpi
          value={Math.round(p.patchPct)}
          suf="%"
          label="Patch compliant"
          tone={p.patchPct >= 90 ? "good" : "warn"}
        />
        <Kpi value={p.exceptions.length} label="App exceptions" />
        <Kpi
          value={net}
          pre={p.movedIn > 0 && net >= 0 ? "+" : ""}
          label="Net people moved"
          tone={net >= 0 ? "good" : "warn"}
        />
      </div>

      <HealthComposition p={p} />
      <Provisioning p={p} />
      <ExperienceCompliance
        p={p}
        cat={cat}
        onCategory={(c) => set({ ticketCategory: c, deviceQuery: query, deviceFilterPersona: p.id })}
      />
      <SupportLoad p={p} />
      <MovementExceptions p={p} personas={model} migrations={migrations.data} apps={catalog.data.apps} />
      <DeviceTable
        p={p}
        cat={cat}
        query={query}
        onQuery={(q) => set({ deviceQuery: q, ticketCategory: cat, deviceFilterPersona: p.id })}
      />
    </Replay>
  );
}
