import { healthTone } from "@pfc/scoring";
import { useParams } from "react-router";
import { AnimNum } from "../components/AnimNum.tsx";
import { Avatar } from "../components/Avatar.tsx";
import { ComingSoon, ErrorMessage, Loading, Panel } from "../components/ui.tsx";
import { toneColor } from "../lib/format.ts";
import { useFleetModel } from "../model/useFleetModel.ts";
import NotFoundPage from "./NotFoundPage.tsx";

export default function DevicePage() {
  const { pid, did } = useParams();
  const { model, isLoading, error } = useFleetModel();

  if (error) return <ErrorMessage error={error} />;
  if (isLoading || !model) return <Loading />;
  const p = model.find((x) => x.id === pid);
  const d = p?.devices.find((x) => x.id === did);
  if (!p || !d) return <NotFoundPage what={`Device "${did}"`} />;

  return (
    <>
      <Panel>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Avatar pid={p.id} size={36} color={p.hue} />
          </div>
          <div style={{ minWidth: 180 }}>
            <h2 style={{ fontSize: 18, fontWeight: 650, margin: 0 }}>{d.user}</h2>
            <div style={{ fontSize: 12, color: "var(--faint)" }}>
              {d.email} · {d.site}
            </div>
            <div className="m" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
              {d.host} · {d.model} · {d.osBuild} · seen {d.lastSeen}d ago
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div className="m" style={{ fontSize: 32, color: toneColor(healthTone(d.score)) }}>
              <AnimNum value={Math.round(d.score)} />
            </div>
            <div className="eyebrow">Device health</div>
          </div>
        </div>
      </Panel>

      <ComingSoon step={7}>
        Bullet charts against the {p.name} baseline, application entitlement, ServiceNow tickets, the
        provisioning request button and suggested actions.
      </ComingSoon>
    </>
  );
}
