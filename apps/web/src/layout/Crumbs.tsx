/* Breadcrumbs and back button, following the wireframe's renderCrumbs. */
import { Fragment } from "react";
import { Link, matchPath, useLocation, useNavigate } from "react-router";
import { useDevices, usePersonas } from "../api/queries.ts";
import { Icon } from "../components/Icon.tsx";

interface Crumb {
  label: string;
  to?: string;
}

const SECTIONS: Record<string, string> = {
  change: "Change",
  tickets: "Tickets",
  baselines: "Baselines",
  switch: "Persona change",
};

export function Crumbs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const personas = usePersonas();
  const devices = useDevices();

  const deviceMatch = matchPath("/personas/:pid/devices/:did", pathname);
  const personaMatch = deviceMatch ?? matchPath("/personas/:pid", pathname);
  const pid = personaMatch?.params.pid;
  const did = deviceMatch?.params.did;
  const section = SECTIONS[pathname.split("/")[1] ?? ""];

  const crumbs: Crumb[] = [{ label: "Personas", to: "/personas" }];
  if (section) crumbs.push({ label: section });
  if (pid)
    crumbs.push({ label: personas.data?.find((p) => p.id === pid)?.name ?? pid, to: `/personas/${pid}` });
  if (pid && did) {
    const host = devices.data?.[pid]?.find((d) => d.id === did)?.host;
    crumbs.push({ label: host ?? did });
  }

  const isLanding = pathname === "/personas" || pathname === "/";
  const backTo = did && pid ? `/personas/${pid}` : "/personas";

  return (
    <nav className="wrap" aria-label="Breadcrumb">
      <div className="crumbs">
        {!isLanding && (
          <button type="button" className="backbtn" aria-label="Back" onClick={() => navigate(backTo)}>
            <Icon name="back" size={14} />
          </button>
        )}
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <Icon name="chevron" size={13} color="var(--faint)" />}
              {last || !c.to ? (
                <span className="last" aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              ) : (
                <Link to={c.to}>{c.label}</Link>
              )}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
