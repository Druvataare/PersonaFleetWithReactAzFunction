/* 05 · SWITCH — pick a user, see their persona, choose a new one, review the impact,
   and apply it through the API. Follows the wireframe's screenSwitch. */
import { RISK_RANK, switchMetrics, type PersonaModel, type ScoredDevice } from "@pfc/scoring";
import { Link } from "react-router";
import { useApplyPersonaChange, useCatalog, usePersonaChanges } from "../api/queries.ts";
import { Avatar } from "../components/Avatar.tsx";
import { Chip, ErrorMessage, Kpi, Loading, PageHead, Panel, Sect, TextKpi } from "../components/ui.tsx";
import { gb } from "../lib/format.ts";
import { useFleetModel } from "../model/useFleetModel.ts";
import { useUi } from "../store/ui.ts";

const HEAD = (
  <PageHead
    step="05 · SWITCH"
    title="Persona change"
    sub="Pick a user, see their persona, choose a new one, and see the benefit before you apply it."
  />
);

type Better = boolean | null;

function ImpactRow({
  label,
  before,
  after,
  better,
  note,
}: {
  label: string;
  before: string | number;
  after: string | number;
  better: Better;
  note: string;
}) {
  const color = better === true ? "var(--good)" : better === false ? "var(--bad)" : "var(--dim)";
  return (
    <tr>
      <td className="l">{label}</td>
      <td className="m" style={{ color: "var(--dim)" }}>
        {before}
      </td>
      <td className="m" style={{ color, fontWeight: 600, whiteSpace: "normal" }}>
        {after}
      </td>
      <td className="l" style={{ color: "var(--faint)", fontSize: 11 }}>
        {note}
      </td>
    </tr>
  );
}

const cmp = (after: number, before: number, lowerIsBetter = false): Better =>
  after === before ? null : after > before !== lowerIsBetter;

export default function SwitchPage() {
  const { model, baselines, error: modelError } = useFleetModel();
  const catalog = useCatalog();
  const changes = usePersonaChanges();
  const apply = useApplyPersonaChange();
  const userId = useUi((s) => s.switchUser);
  const to = useUi((s) => s.switchTo);
  const set = useUi((s) => s.set);

  const error = modelError ?? catalog.error ?? changes.error;
  if (error)
    return (
      <>
        {HEAD}
        <ErrorMessage error={error} />
      </>
    );
  if (!model || !baselines || !catalog.data || !changes.data)
    return (
      <>
        {HEAD}
        <Loading />
      </>
    );

  const owner: PersonaModel | undefined = model.find((p) => p.devices.some((d) => d.id === userId));
  const device: ScoredDevice | undefined = owner?.devices.find((d) => d.id === userId);
  const name = (id: string) => model.find((p) => p.id === id)?.name ?? id;

  const selectUser = (id: string) => {
    apply.reset();
    set({ switchUser: id, switchTo: "" });
  };
  const selectTarget = (id: string) => {
    apply.reset();
    set({ switchTo: id });
  };
  const startAgain = () => {
    apply.reset();
    set({ switchUser: "", switchTo: "" });
  };
  const applyChange = () => {
    if (!device || !to) return;
    apply.mutate({ userId: device.id, to }, { onSuccess: () => set({ switchTo: "" }) });
  };

  const done = apply.data?.change;

  return (
    <>
      {HEAD}
      {done && (
        <div
          role="status"
          style={{
            background: "var(--hover)",
            border: "1px solid var(--good)",
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
            color: "var(--good)",
            marginBottom: 14,
          }}
        >
          Persona changed: {done.user} moved from {name(done.from)} to {name(done.to)}. Personas, Change and
          persona pages are updated.
        </div>
      )}
      {apply.error && (
        <div
          role="alert"
          style={{
            border: "1px solid var(--bad)",
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
            color: "var(--bad)",
            marginBottom: 14,
          }}
        >
          Could not apply the change: {apply.error.message}. Nothing was changed.
        </div>
      )}

      <Panel style={{ marginBottom: 14 }}>
        <label className="eyebrow" htmlFor="swuser" style={{ display: "block", marginBottom: 10 }}>
          Step 1 · Select user
        </label>
        <select
          id="swuser"
          className="theme-sel"
          style={{ minWidth: 260 }}
          value={device ? userId : ""}
          onChange={(e) => selectUser(e.target.value)}
        >
          <option value="">Select a user</option>
          {model.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {p.devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.user} · {d.host}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Panel>

      {device && owner && (
        <div style={{ marginBottom: 14 }}>
          <Panel>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Step 2 · Current persona (auto-selected)
            </div>
            <div
              style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}
              role="group"
              aria-label="Current persona"
            >
              <Avatar pid={owner.id} size={40} color={owner.hue} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{owner.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
                  {device.user} · {device.email} · {device.site} · {device.model} · {device.ramGB}GB RAM ·{" "}
                  {gb(device.storageGB)}
                </div>
              </div>
            </div>
            <label className="eyebrow" htmlFor="swto" style={{ display: "block", margin: "16px 0 8px" }}>
              Step 3 · Choose new persona
            </label>
            <select
              id="swto"
              className="theme-sel"
              style={{ minWidth: 260 }}
              value={to}
              onChange={(e) => selectTarget(e.target.value)}
            >
              <option value="">Select a persona</option>
              {model
                .filter((p) => p.id !== owner.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Panel>
        </div>
      )}

      {device && owner && to && to !== owner.id && (
        <Impact
          device={device}
          from={owner.id}
          to={to}
          name={name}
          ctx={{
            baselines,
            apps: catalog.data.apps,
            tasksAutomated: catalog.data.tasksAutomated,
            onboardingDays: catalog.data.onboardingDays,
          }}
          pending={apply.isPending}
          onApply={applyChange}
          onStartAgain={startAgain}
        />
      )}

      {changes.data.length > 0 && (
        <>
          <Sect>Persona change log</Sect>
          <Panel pad={0}>
            <div className="tscroll">
              <table aria-label="Persona change log">
                <thead>
                  <tr>
                    <th className="l">Date</th>
                    <th className="l">User</th>
                    <th className="l">From</th>
                    <th className="l">To</th>
                    <th className="l">See it on</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.data.map((c) => (
                    <tr key={c.date + c.id + c.to} style={{ cursor: "default" }}>
                      <td className="l">{c.date}</td>
                      <td className="l">{c.user}</td>
                      <td className="l">{name(c.from)}</td>
                      <td className="l">{name(c.to)}</td>
                      <td className="l">
                        <Link className="link" to={`/personas/${c.to}`}>
                          {name(c.to)} page
                        </Link>{" "}
                        ·{" "}
                        <Link className="link" to="/change">
                          Change page
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

interface ImpactProps {
  device: ScoredDevice;
  from: string;
  to: string;
  name: (id: string) => string;
  ctx: Parameters<typeof switchMetrics>[3];
  pending: boolean;
  onApply: () => void;
  onStartAgain: () => void;
}

function Impact({ device: d, from, to, name, ctx, pending, onApply, onStartAgain }: ImpactProps) {
  const m = switchMetrics(d, from, to, ctx);
  const bT = ctx.baselines[to];
  const taskDelta = m.tasksAfter - m.tasksBefore;
  return (
    <>
      <Sect>{`Step 4 · Impact of moving ${d.user} from ${name(from)} to ${name(to)}`}</Sect>
      <div className="g4" style={{ marginBottom: 14 }}>
        <Kpi value={m.prodBefore} suf={` → ${m.prodAfter}`} label="Productivity score (of 100)" tone="good" />
        <Kpi
          value={taskDelta}
          pre={taskDelta >= 0 ? "+" : ""}
          suf=" / wk"
          label="Tasks automated"
          tone={taskDelta >= 0 ? "good" : "warn"}
        />
        <TextKpi value={`${m.riskBefore} → ${m.riskAfter}`} label="Security risk" tone="good" />
        <Kpi value={m.uxBefore} suf={` → ${m.uxAfter}`} label="User experience score" tone="good" />
      </div>
      <Panel pad={0}>
        <div className="tscroll">
          <table aria-label="Impact of the persona change">
            <thead>
              <tr>
                <th className="l">Measure</th>
                <th>Today ({name(from)})</th>
                <th>After change ({name(to)})</th>
                <th className="l">How it is worked out</th>
              </tr>
            </thead>
            <tbody>
              <ImpactRow
                label="Productivity score"
                before={m.prodBefore}
                after={m.prodAfter}
                better={m.prodAfter > m.prodBefore}
                note={`Device graded against the ${name(to)} baseline`}
              />
              <ImpactRow
                label="Tasks automated per week"
                before={m.tasksBefore}
                after={m.tasksAfter}
                better={cmp(m.tasksAfter, m.tasksBefore)}
                note="Persona standard build"
              />
              <ImpactRow
                label="Apps added"
                before="—"
                after={m.add.length ? m.add.join(", ") : "None"}
                better={m.add.length ? true : null}
                note={`From the ${name(to)} catalogue`}
              />
              <ImpactRow
                label="Apps removed"
                before="—"
                after={m.rem.length ? m.rem.join(", ") : "None"}
                better={null}
                note="Not in the new catalogue"
              />
              <ImpactRow
                label="Apps to install on this device"
                before="—"
                after={m.need.length}
                better={null}
                note="New catalogue apps not yet installed"
              />
              <ImpactRow
                label="Security risk level"
                before={m.riskBefore}
                after={m.riskAfter}
                better={RISK_RANK[m.riskAfter] < RISK_RANK[m.riskBefore] ? true : null}
                note="Patched, Win11 standard image"
              />
              <ImpactRow
                label="Device fit for role"
                before={m.fitBefore ? "Yes" : "No"}
                after="Yes"
                better={m.fitBefore ? null : true}
                note="RAM, storage and CPU vs new baseline"
              />
              <ImpactRow
                label="RAM"
                before={m.ramBefore + "GB"}
                after={m.ramAfter + "GB"}
                better={m.ramAfter > m.ramBefore ? true : null}
                note={`Baseline ${bT.ramGB}GB`}
              />
              <ImpactRow
                label="Storage"
                before={gb(m.stBefore)}
                after={gb(m.stAfter)}
                better={m.stAfter > m.stBefore ? true : null}
                note={`Baseline ${gb(bT.storageGB)}`}
              />
              <ImpactRow
                label="Boot time"
                before={m.bootBefore + "s"}
                after={m.bootAfter + "s"}
                better={cmp(m.bootAfter, m.bootBefore, true)}
                note="Baseline target"
              />
              <ImpactRow
                label="Support tickets per user"
                before={m.tixBefore}
                after={m.tixAfter}
                better={cmp(m.tixAfter, m.tixBefore, true)}
                note={`Open now vs ${name(to)} ceiling`}
              />
              <ImpactRow
                label="Onboarding time (days)"
                before={m.onBefore}
                after={m.onAfter}
                better={cmp(m.onAfter, m.onBefore, true)}
                note="Days to be ready"
              />
              <ImpactRow
                label="User experience score"
                before={m.uxBefore}
                after={m.uxAfter}
                better={m.uxAfter > m.uxBefore}
                note="Free disk, battery, crashes"
              />
            </tbody>
          </table>
        </div>
      </Panel>
      <div style={{ fontSize: 11, color: "var(--faint)", margin: "8px 0 14px" }}>
        "After" values assume the device is brought up to the {name(to)} baseline. Figures are estimates for
        demo.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Chip on disabled={pending} onClick={onApply}>
          {pending ? "Applying…" : "Apply persona change"}
        </Chip>
        <Chip onClick={onStartAgain}>Start again</Chip>
      </div>
    </>
  );
}
