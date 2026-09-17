/* 01 · WHO — the landing page: persona health, then how people were mapped into personas. */
import { usePersonas } from "../api/queries.ts";
import { Chip, ErrorMessage, Kpi, Loading, PageHead } from "../components/ui.tsx";
import { useFleetModel } from "../model/useFleetModel.ts";
import { Replay } from "../motion/clock.tsx";
import { useUi } from "../store/ui.ts";
import { MappingConfidence } from "./personas/MappingConfidence.tsx";
import { PersonaGrid } from "./personas/PersonaGrid.tsx";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export default function PersonasPage() {
  const { model, isLoading, error } = useFleetModel();
  const personas = usePersonas();
  const filter = useUi((s) => s.personaFilter);
  const mappingPersona = useUi((s) => s.mappingPersona);
  const mappingBand = useUi((s) => s.mappingBand);
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

  return (
    /* Like the wireframe, charts replay whenever a filter changes. Typing in search does not. */
    <Replay on={[filter, mappingPersona, mappingBand]}>
      <PageHead
        step="01 · WHO"
        title="Personas"
        sub="Seven personas, every device in the fleet, and the job titles that put people into them. Everything downstream starts here."
        tools={chips}
      />
      {error ? (
        <ErrorMessage error={error} />
      ) : isLoading || !model || !personas.data ? (
        <Loading />
      ) : (
        <>
          <div className="g4" style={{ marginBottom: 18 }}>
            <Kpi value={model.length} label="Personas" />
            <Kpi value={sum(model.map((p) => p.count))} label="Devices in estate" />
            <Kpi value={sum(model.map((p) => p.underCount))} label="Under baseline" tone="bad" />
            <Kpi value={sum(model.map((p) => p.openTickets))} label="Open tickets" tone="warn" />
          </div>
          <PersonaGrid personas={model.filter((p) => (filter === "risk" ? p.health < 85 : true))} />
          <MappingConfidence personas={personas.data} />
        </>
      )}
    </Replay>
  );
}
