/* 02 · WHAT THEY GET — where the fleet stands, the contract behind it, and which
   component is missing. Sliders edit a draft baseline that every page grades against. */
import { fitByPersona } from "@pfc/scoring";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useCatalog } from "../api/queries.ts";
import { Icon } from "../components/Icon.tsx";
import { ErrorMessage, Loading, PageHead, Sect } from "../components/ui.tsx";
import { useFleetModel } from "../model/useFleetModel.ts";
import { Replay } from "../motion/clock.tsx";
import { useUi } from "../store/ui.ts";
import NotFoundPage from "./NotFoundPage.tsx";
import {
  AppCatalogue,
  ComponentTables,
  ContractSliders,
  FitCharts,
  FitTiles,
  LiveImpact,
  PersonaStrip,
} from "./baselines/sections.tsx";

const TITLE = "Baselines & device fit";
const SUB =
  "Where the fleet stands today, the contract behind it, and which component is missing. Move any slider and every number on this page re-grades.";

export default function BaselinesPage() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const { model, defaults, isLoading, error } = useFleetModel();
  const catalog = useCatalog();
  const setBaselineField = useUi((s) => s.setBaselineField);
  const resetBaseline = useUi((s) => s.resetBaseline);
  /* Reset replays the animations, as the wireframe re-renders on reset; slider moves do not. */
  const [resets, setResets] = useState(0);

  const loadError = error ?? catalog.error;
  if (loadError)
    return (
      <>
        <PageHead step="02 · WHAT THEY GET" title={TITLE} sub={SUB} />
        <ErrorMessage error={loadError} />
      </>
    );
  if (isLoading || !model || !defaults || !catalog.data)
    return (
      <>
        <PageHead step="02 · WHAT THEY GET" title={TITLE} sub={SUB} />
        <Loading />
      </>
    );

  const focus = pid ?? model[0].id;
  const p = model.find((x) => x.id === focus);
  if (!p) return <NotFoundPage what={`Persona "${pid}"`} />;

  const dirty = JSON.stringify(p.baseline) !== JSON.stringify(defaults[p.id]);
  const reset = () => {
    resetBaseline(p.id);
    setResets((r) => r + 1);
  };
  const pick = (id: string) => navigate(`/baselines/${id}`);
  const fit = fitByPersona(model);

  return (
    <Replay on={[focus, resets]}>
      <PageHead
        step="02 · WHAT THEY GET"
        title={TITLE}
        sub={SUB}
        tools={
          dirty ? (
            <>
              <span className="m" style={{ fontSize: 10, color: "var(--warn)" }}>
                UNSAVED CHANGES
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={reset}
                style={{ fontSize: 11, padding: "5px 9px" }}
              >
                <Icon name="reset" size={11} /> Reset {p.name}
              </button>
            </>
          ) : null
        }
      />

      <PersonaStrip personas={model} focus={p.id} onPick={pick} />

      <Sect>Where the fleet stands</Sect>
      <FitTiles rows={fit} personaCount={model.length} />
      <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--faint)" }}>
        Fit is judged on CPU, memory and storage only. Below on two parts or more is a critical mismatch;
        above on any part with none below is over-provisioned spend.
      </div>

      <Sect>The contract</Sect>
      <div className="gmain">
        <ContractSliders
          p={p}
          defaults={defaults[p.id]}
          dirty={dirty}
          onChange={(field, value) => setBaselineField(p.id, p.baseline, field, value)}
          onReset={reset}
        />
        <LiveImpact p={p} />
      </div>

      <Sect>Why the fleet misses it</Sect>
      <FitCharts rows={fit} />

      <Sect>Which component fails</Sect>
      <ComponentTables rows={fit} personas={model} defaults={defaults} onPick={pick} />

      <Sect>Persona app catalogue</Sect>
      <AppCatalogue name={p.name} apps={catalog.data.apps[p.id] ?? []} />
    </Replay>
  );
}
