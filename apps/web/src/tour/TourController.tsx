/* Drives the guided tour: navigates, sets filters, scrolls, auto-advances, and
   renders the caption and control bar. Follows the wireframe's tourGo / tourMarkup. */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useUi } from "../store/ui.ts";
import { useTour } from "./store.ts";
import { sameScreen, TOUR, tourPath } from "./steps.ts";

const SCROLL_OFFSET = 96;

/** Scrolls to the n-th section heading once the page has rendered it. */
function scrollToSection(index: number, delay: number): () => void {
  let cancelled = false;
  let timer = window.setTimeout(function attempt(tries = 0) {
    if (cancelled) return;
    const el = document.querySelectorAll("#app .sect")[index];
    if (el) {
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET);
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    } else if (tries < 40) {
      /* Data may still be loading: keep looking for up to 4 seconds. */
      timer = window.setTimeout(() => attempt(tries + 1), 100);
    }
  }, delay);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}

export function TourController() {
  const navigate = useNavigate();
  const { active, step, paused, captions } = useTour();
  const lastApplied = useRef<number | null>(null);
  const { pathname } = useLocation();
  const currentPath = useRef(pathname);
  useEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);

  /* Stop: reset the page state the tour changed and return to Personas, as the wireframe does. */
  const wasActive = useRef(false);
  useEffect(() => {
    if (active) {
      wasActive.current = true;
      return;
    }
    lastApplied.current = null;
    if (wasActive.current) {
      wasActive.current = false;
      useUi.getState().resetFilters();
      navigate("/personas");
    }
  }, [active, navigate]);

  /* Apply the current step. */
  useEffect(() => {
    if (!active || lastApplied.current === step) return;
    const prev = lastApplied.current === null ? undefined : TOUR[lastApplied.current];
    lastApplied.current = step;
    const st = TOUR[step];
    if (st.kind === "title") return;

    const same = sameScreen(prev, st);
    const ui = useUi.getState();
    if (st.view === "landing") ui.set({ mappingBand: st.cband ?? null });
    if (st.view === "tickets") ui.set({ ticketKind: st.tmode ?? "inc", ticketCatFilter: null });

    const path = tourPath(st);
    if (path && currentPath.current !== path) navigate(path);

    if (st.scroll !== undefined) return scrollToSection(st.scroll, same ? 60 : 420);
    if (!same) window.scrollTo({ top: 0, behavior: "instant" });
  }, [active, step, navigate]);

  /* Auto-advance. Resuming restarts the step's full duration, as in the wireframe. */
  useEffect(() => {
    if (!active || paused) return;
    const timer = window.setTimeout(() => useTour.getState().go(step + 1), TOUR[step].dur);
    return () => window.clearTimeout(timer);
  }, [active, step, paused]);

  /* Body classes and keyboard shortcuts. */
  useEffect(() => {
    document.body.classList.toggle("tour", active);
    document.body.classList.toggle("captionsoff", active && !captions);
  }, [active, captions]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = useTour.getState();
      if (e.code === "Space") {
        e.preventDefault();
        t.togglePause();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        t.go(t.step + 1);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        t.go(t.step - 1);
      } else if (e.code === "Escape") {
        t.stop();
      } else if (e.code === "KeyC") {
        t.toggleCaptions();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (!active) return null;
  return <TourOverlay />;
}

function TourOverlay() {
  const { step, paused, go, togglePause, toggleCaptions, stop } = useTour();
  const st = TOUR[step];
  const pct = ((step + 1) / TOUR.length) * 100;
  return (
    <div id="tourui" role="region" aria-label="Guided tour">
      <div className="tour-prog" style={{ width: `${pct}%` }} />
      {st.kind === "title" ? (
        <div className="tour-title">
          <div>
            <h1>{st.cap}</h1>
            <p>{st.sub}</p>
          </div>
        </div>
      ) : (
        <div className="tour-cap" aria-live="polite">
          <div className="tour-cap-eyebrow">{st.eyebrow ?? ""}</div>
          <div className="tour-cap-text">{st.cap}</div>
        </div>
      )}
      <div className="tour-bar">
        <button type="button" title="Previous step" aria-label="Previous step" onClick={() => go(step - 1)}>
          ‹
        </button>
        <button
          type="button"
          title={paused ? "Resume" : "Pause"}
          aria-label={paused ? "Resume" : "Pause"}
          onClick={togglePause}
        >
          {paused ? "▶" : "❚❚"}
        </button>
        <button type="button" title="Next step" aria-label="Next step" onClick={() => go(step + 1)}>
          ›
        </button>
        <span className="tour-step">
          {String(step + 1).padStart(2, "0")} / {TOUR.length}
        </span>
        <button
          type="button"
          className="wide"
          title="Show or hide captions"
          aria-label="Show or hide captions"
          onClick={toggleCaptions}
        >
          CC
        </button>
        <button type="button" title="Exit tour" aria-label="Exit tour" onClick={stop}>
          ✕
        </button>
      </div>
    </div>
  );
}
