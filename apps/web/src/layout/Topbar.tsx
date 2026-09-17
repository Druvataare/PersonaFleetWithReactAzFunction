import { NavLink } from "react-router";
import { Icon, type IconName } from "../components/Icon.tsx";
import { useUi } from "../store/ui.ts";
import { THEME_KEYS, THEMES, isThemeKey } from "../theme/themes.ts";
import { useTour } from "../tour/store.ts";

const NAV: ReadonlyArray<{ to: string; label: string; icon: IconName }> = [
  { to: "/personas", label: "Personas", icon: "layers" },
  { to: "/baselines", label: "Baselines", icon: "gear" },
  { to: "/tickets", label: "Tickets", icon: "ticket" },
  { to: "/change", label: "Change", icon: "swap" },
  { to: "/switch", label: "Switch", icon: "swap" },
];

function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="11.4" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <circle
        cx="13"
        cy="13"
        r="11.4"
        fill="none"
        stroke="var(--good)"
        strokeWidth="2.6"
        strokeDasharray="52 72"
        strokeLinecap="round"
        transform="rotate(-90 13 13)"
      />
      <circle cx="13" cy="9.5" r="2.6" fill="var(--text)" />
      <path
        d="M7.6 19.5a5.6 5.2 0 0 1 10.8 0"
        fill="none"
        stroke="var(--text)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Topbar() {
  const { theme, motion, chartNames, setTheme, toggleMotion, toggleChartNames } = useUi();
  const startTour = useTour((t) => t.start);
  const mocks = import.meta.env.VITE_USE_MOCKS === "true";

  return (
    <header className="topbar">
      <div className="wrap topbar-in">
        <NavLink to="/personas" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <BrandMark />
          <div>
            <div className="brand-name">Persona Fleet Command</div>
            <div className="brand-sub">ENDPOINT EXPERIENCE PORTAL</div>
          </div>
        </NavLink>

        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "on" : undefined)}>
              <Icon name={n.icon} size={14} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="marks">
          {mocks && (
            <span className="mark mock" title="Data is served by the in-browser mock API">
              DEMO DATA
            </span>
          )}
          <button
            type="button"
            className={`toggle${motion ? " on" : ""}`}
            aria-pressed={motion}
            onClick={toggleMotion}
            title="Animate charts on each view"
          >
            MOTION
          </button>
          <button
            type="button"
            className={`toggle${chartNames ? " on" : ""}`}
            aria-pressed={chartNames}
            onClick={toggleChartNames}
            title="Show the chart type used for each visual"
          >
            CHART NAMES
          </button>
          <button
            type="button"
            className="toggle"
            onClick={startTour}
            title="Play a self-driving walkthrough of every screen — record this"
          >
            &#9654; TOUR
          </button>
          <label className="sr-only" htmlFor="themesel">
            Theme
          </label>
          <select
            id="themesel"
            className="theme-sel"
            value={theme}
            onChange={(e) => isThemeKey(e.target.value) && setTheme(e.target.value)}
          >
            {THEME_KEYS.map((k) => (
              <option key={k} value={k}>
                {THEMES[k].label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
