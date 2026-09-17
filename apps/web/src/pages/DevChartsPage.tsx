/* Temporary step 5 page: every chart on real mock data, for comparison with the
   wireframe. Removed in step 12. */
import { fitByPersona, FIT_KINDS, healthTone, type PersonaId } from "@pfc/scoring";
import { useState, type ReactNode } from "react";
import { useMappingSummary, useMigrations, usePersonas, useTicketSummary } from "../api/queries.ts";
import {
  BarList,
  BaselineHistogram,
  BinHistogram,
  BootScatter,
  Bullet,
  ComplianceBySite,
  Donut,
  FitStack,
  incidentCategoryColor,
  MigrationFlow,
  PersonaRing,
  PillarGauge,
  StackedAge,
  TrendArea,
  ticketCategoryColor,
  WeekBars,
} from "../charts/index.ts";
import { ChartType, Chip, ErrorMessage, Loading, PageHead, Panel, Sect } from "../components/ui.tsx";
import { ageByPriority, tally } from "../lib/aggregate.ts";
import { TICKET_CATS } from "../lib/categories.ts";
import { personaTrend } from "../lib/trend.ts";
import { useFleetModel } from "../model/useFleetModel.ts";
import { Replay } from "../motion/clock.tsx";
import { usePalette } from "../theme/usePalette.ts";

function Card({ title, type, children }: { title: string; type: string; children: ReactNode }) {
  return (
    <Panel>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {title}
        <ChartType name={type} />
      </div>
      {children}
    </Panel>
  );
}

export default function DevChartsPage() {
  const C = usePalette();
  const { model, error } = useFleetModel();
  const personas = usePersonas();
  const migrations = useMigrations();
  const incidents = useTicketSummary("inc", "all", null);
  const mapping = useMappingSummary("all");
  const [pid, setPid] = useState<PersonaId>("CC");
  const [replay, setReplay] = useState(0);
  const [cat, setCat] = useState<string | null>(null);
  const [tcat, setTcat] = useState<string | null>(null);
  const [mapPersona, setMapPersona] = useState<string | null>(null);

  const head = (
    <PageHead
      step="DEV · STEP 5"
      title="Chart library"
      sub="Every wireframe chart on live mock data. Switch themes and MOTION in the top bar; use Replay to rerun the animations. Temporary page, removed in step 12."
      tools={
        <>
          {model?.map((p) => (
            <Chip key={p.id} on={pid === p.id} onClick={() => setPid(p.id)}>
              {p.id}
            </Chip>
          ))}
          <Chip onClick={() => setReplay((r) => r + 1)}>Replay</Chip>
        </>
      }
    />
  );

  if (error) return <ErrorMessage error={error} />;
  if (!model || !personas.data || !migrations.data || !incidents.data || !mapping.data)
    return (
      <>
        {head}
        <Loading />
      </>
    );

  const p = model.find((x) => x.id === pid)!;
  const b = p.baseline;
  const tickets = p.devices.flatMap((d) => d.tickets);
  const byCat = TICKET_CATS.map((c) => ({ key: c, n: tickets.filter((t) => t.cat === c).length })).filter(
    (d) => d.n,
  );
  const incColor = incidentCategoryColor(C);
  const tColor = ticketCategoryColor(C);
  const fit = fitByPersona(model);
  const fitTotals = FIT_KINDS.map(({ key, tone }) => ({
    key,
    n: fit.reduce((a, r) => a + r[key], 0),
    color: C[tone],
  })).filter((d) => d.n);
  const device = [...p.devices].sort((a, c) => a.score - c.score)[0];

  return (
    <Replay on={[replay, pid]}>
      {head}

      <Sect>Rings and gauges</Sect>
      <div className="personas">
        {model.map((x) => (
          <div key={x.id} style={{ textAlign: "center" }}>
            <PersonaRing pid={x.id} health={x.health} underPct={x.underPct} label={`${x.name} health`} />
            <div className="ring-name">{x.name}</div>
          </div>
        ))}
      </div>
      <div className="g3" style={{ marginTop: 16 }}>
        <Card title={`Five pillars · ${p.name}`} type="RADIAL GAUGE">
          <div style={{ maxWidth: 180 }}>
            <PillarGauge pillars={p.pillars} size={180} />
          </div>
        </Card>
        <Card title="Health trend · 12 weeks" type="AREA / SPARKLINE">
          <TrendArea series={personaTrend(p.id, p.health)} color={p.hue} />
        </Card>
        <Card title="Device health spread" type="BINNED HISTOGRAM">
          <BinHistogram
            values={p.devices.map((d) => d.score)}
            thresholds={[50, 60, 70, 80, 90]}
            binLabel={(bn) => Math.round(bn.x0 ?? 0)}
            binColor={(bn) => C[healthTone(((bn.x0 ?? 0) + (bn.x1 ?? 0)) / 2)]}
            label="DEVICE HEALTH SCORE"
          />
        </Card>
      </div>

      <Sect>Provisioning against baseline</Sect>
      <div className="g3">
        <Card title="Memory" type="HISTOGRAM + THRESHOLD">
          <BaselineHistogram
            values={p.devices.map((d) => d.ramGB)}
            baseValue={b.ramGB}
            label="RAM (GB)"
            unit="GB"
          />
        </Card>
        <Card title="Storage" type="HISTOGRAM + THRESHOLD">
          <BaselineHistogram
            values={p.devices.map((d) => d.storageGB)}
            baseValue={b.storageGB}
            label="DISK (GB)"
            unit="GB"
          />
        </Card>
        <Card title="CPU index" type="BINNED HISTOGRAM">
          <BinHistogram
            values={p.devices.map((d) => d.cpuScore)}
            thresholds={[40, 50, 60, 70, 80, 90]}
            binLabel={(bn) => Math.round(bn.x0 ?? 0)}
            binColor={(bn) => (((bn.x0 ?? 0) + (bn.x1 ?? 0)) / 2 >= b.cpuScore ? C.good : C.bad)}
            label="CPU BENCHMARK INDEX"
          />
        </Card>
      </div>

      <Sect>Experience, compliance and tickets</Sect>
      <div className="g3">
        <Card title="Boot time against free disk" type="BUBBLE SCATTER">
          <BootScatter devices={p.devices} baseline={b} />
        </Card>
        <Card title="Patch compliance by location" type="PROGRESS BAR CHART">
          <ComplianceBySite devices={p.devices} />
        </Card>
        <Card title="Ticket mix (click a slice)" type="DONUT">
          <div style={{ maxWidth: 160 }}>
            <Donut
              rows={byCat.map((d) => ({ ...d, color: incColor(d.key) }))}
              centerLabel="TICKETS"
              size={160}
              thickness={24}
              padAngle={0.02}
              dimOpacity={0.25}
              delayStep={70}
              centerSize={22}
              active={cat}
              onSelect={(k) => setCat(cat === k ? null : k)}
            />
          </div>
        </Card>
        <Card title="Open tickets by age and priority" type="STACKED COLUMN">
          <StackedAge buckets={ageByPriority(tickets)} />
        </Card>
        <Card title="What people actually report" type="RANKED BAR">
          <BarList rows={tally(tickets, (t) => t.short).slice(0, 6)} color={C.warn} />
        </Card>
        <Card title={`Actual against ${p.name} baseline · ${device.host}`} type="BULLET CHART">
          <Bullet
            label="Memory"
            actual={device.ramGB}
            target={b.ramGB}
            max={Math.max(b.ramGB, device.ramGB) * 1.15}
            unit="GB"
            icon="ram"
          />
          <Bullet
            label="CPU index"
            actual={device.cpuScore}
            target={b.cpuScore}
            max={100}
            unit=""
            icon="cpu"
          />
          <Bullet
            label="Boot time"
            actual={device.bootSec}
            target={b.bootSec}
            max={Math.max(b.bootSec, device.bootSec) * 1.15}
            unit="s"
            invert
            icon="clock"
          />
        </Card>
      </div>

      <Sect>Fleet-wide</Sect>
      <div className="g2">
        <Card title="Ticket distribution by category (click a slice)" type="DONUT">
          <div style={{ maxWidth: 190 }}>
            <Donut
              rows={incidents.data.byCategory.map((d) => ({ key: d.k, n: d.n, color: tColor(d.k) }))}
              centerLabel="TICKETS"
              delayStep={55}
              active={tcat}
              onSelect={(k) => setTcat(tcat === k ? null : k)}
            />
          </div>
        </Card>
        <Card title="Count of job title by persona (click a slice)" type="DONUT">
          <div style={{ maxWidth: 190 }}>
            <Donut
              rows={mapping.data.byPersona.map((d) => ({
                key: d.k,
                n: d.n,
                color: personas.data.find((x) => x.id === d.k)?.hue ?? C.accent,
              }))}
              centerLabel="TITLES"
              active={mapPersona}
              onSelect={(k) => setMapPersona(mapPersona === k ? null : k)}
            />
          </div>
        </Card>
        <Card title="Volume by week" type="COLUMN CHART">
          <WeekBars series={incidents.data.weeks} color={C.warn} />
        </Card>
        <Card title="Overall fit status" type="DONUT">
          <div style={{ maxWidth: 180 }}>
            <Donut
              rows={fitTotals}
              centerLabel="DEVICES"
              size={180}
              thickness={28}
              dimOpacity={0.92}
              delayStep={70}
            />
          </div>
        </Card>
        <Card title="Where people moved this quarter" type="SANKEY-STYLE FLOW">
          <MigrationFlow migrations={migrations.data} personas={personas.data} />
        </Card>
        <Card title="Fit distribution by persona" type="STACKED BAR">
          <FitStack rows={fit} />
        </Card>
      </div>
    </Replay>
  );
}
