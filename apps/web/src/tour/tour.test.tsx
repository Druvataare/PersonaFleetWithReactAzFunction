/* Guided tour: script parity with the wireframe, auto-advance, navigation,
   filters, scrolling, controls and keyboard shortcuts. */
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWireframe } from "../mocks/data/wireframe.ts";
import { useUi } from "../store/ui.ts";
import { renderApp } from "../test/renderApp.tsx";
import { useTour } from "./store.ts";
import { sameScreen, TOUR, tourPath } from "./steps.ts";

const wf = loadWireframe();

describe("tour script", () => {
  it("is identical to the wireframe's TOUR (18 steps, captions, timings, screens, filters, scroll targets)", () => {
    expect(TOUR).toEqual(wf.TOUR);
    expect(TOUR).toHaveLength(18);
  });

  it("runs about four minutes, matching the narration", () => {
    const seconds = TOUR.reduce((a, s) => a + s.dur, 0) / 1000;
    expect(seconds).toBe(227);
  });

  it("maps views to routes", () => {
    expect(tourPath(TOUR[1])).toBe("/personas");
    expect(tourPath(TOUR[8])).toBe("/baselines/DS");
    expect(tourPath(TOUR[11])).toBe("/tickets");
    expect(tourPath(TOUR[15])).toBe("/change");
    expect(tourPath(TOUR[0])).toBeNull();
  });

  it("detects same-screen steps like the wireframe", () => {
    expect(sameScreen(TOUR[1], TOUR[2])).toBe(true);
    expect(sameScreen(TOUR[3], TOUR[4])).toBe(false); // band changes
    expect(sameScreen(TOUR[7], TOUR[8])).toBe(false); // persona changes
    expect(sameScreen(TOUR[0], TOUR[1])).toBe(false); // from the title card
  });
});

describe("tour in the app", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
    act(() => useTour.setState({ active: false, step: 0, paused: false, captions: true }));
  });
  afterEach(() => {
    act(() => useTour.getState().stop());
    vi.useRealTimers();
  });

  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };
  const bar = () => within(screen.getByRole("region", { name: "Guided tour" }));

  const startFrom = async (path: string) => {
    const utils = renderApp(path);
    await screen.findByRole("heading", { level: 2 });
    fireEvent.click(screen.getByRole("button", { name: /TOUR/ }));
    return utils;
  };

  it("starts with the title card and auto-advances through the steps", async () => {
    const { router } = await startFrom("/tickets");
    expect(document.body).toHaveClass("tour");
    expect(bar().getByRole("heading", { level: 1, name: "Persona Fleet Command" })).toBeInTheDocument();
    expect(bar().getByText("ENDPOINT EXPERIENCE PORTAL")).toBeInTheDocument();
    expect(bar().getByText("01 / 18")).toBeInTheDocument();

    await advance(5000);
    expect(router.state.location.pathname).toBe("/personas");
    expect(bar().getByText("02 / 18")).toBeInTheDocument();
    expect(bar().getByText(TOUR[1].cap)).toBeInTheDocument();
    expect(bar().getByText("01 · PERSONAS")).toBeInTheDocument();

    await advance(13000);
    expect(bar().getByText("03 / 18")).toBeInTheDocument();
  });

  it("applies each step's screen, persona, band and ticket mode", async () => {
    const { router } = await startFrom("/personas");
    const goTo = async (i: number) => {
      act(() => useTour.getState().go(i));
      await advance(0);
    };

    await goTo(4);
    expect(useUi.getState().mappingBand).toBe("low");
    expect(router.state.location.pathname).toBe("/personas");

    await goTo(6);
    expect(router.state.location.pathname).toBe("/baselines/DEV");
    await goTo(8);
    expect(router.state.location.pathname).toBe("/baselines/DS");
    await goTo(10);
    expect(router.state.location.pathname).toBe("/baselines/CC");

    await goTo(14);
    expect(router.state.location.pathname).toBe("/tickets");
    expect(useUi.getState().ticketKind).toBe("req");
    await goTo(13);
    expect(useUi.getState().ticketKind).toBe("inc");

    await goTo(15);
    expect(router.state.location.pathname).toBe("/change");
  });

  it("scrolls to the step's section once the page has rendered it", async () => {
    await startFrom("/personas");
    const scroll = vi.mocked(window.scrollTo);
    scroll.mockClear();
    act(() => useTour.getState().go(3));
    await advance(1000);
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
  });

  it("previous, next, pause and resume", async () => {
    await startFrom("/personas");
    fireEvent.click(bar().getByRole("button", { name: "Next step" }));
    fireEvent.click(bar().getByRole("button", { name: "Next step" }));
    expect(bar().getByText("03 / 18")).toBeInTheDocument();
    fireEvent.click(bar().getByRole("button", { name: "Previous step" }));
    expect(bar().getByText("02 / 18")).toBeInTheDocument();

    fireEvent.click(bar().getByRole("button", { name: "Pause" }));
    await advance(60000);
    expect(bar().getByText("02 / 18")).toBeInTheDocument();
    fireEvent.click(bar().getByRole("button", { name: "Resume" }));
    await advance(TOUR[1].dur);
    expect(bar().getByText("03 / 18")).toBeInTheDocument();

    act(() => useTour.getState().go(0));
    fireEvent.click(bar().getByRole("button", { name: "Previous step" }));
    expect(bar().getByText("01 / 18")).toBeInTheDocument();
  });

  it("shows progress", async () => {
    await startFrom("/personas");
    act(() => useTour.getState().go(8));
    expect(document.querySelector<HTMLElement>(".tour-prog")!.style.width).toBe(`${(9 / 18) * 100}%`);
  });

  it("keyboard: Space pauses, arrows step, C toggles captions, Escape exits", async () => {
    const { router } = await startFrom("/tickets");
    fireEvent.keyDown(window, { code: "ArrowRight" });
    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(useTour.getState().step).toBe(2);
    fireEvent.keyDown(window, { code: "ArrowLeft" });
    expect(useTour.getState().step).toBe(1);
    fireEvent.keyDown(window, { code: "Space" });
    expect(useTour.getState().paused).toBe(true);
    fireEvent.keyDown(window, { code: "KeyC" });
    expect(document.body).toHaveClass("captionsoff");
    fireEvent.keyDown(window, { code: "KeyC" });
    expect(document.body).not.toHaveClass("captionsoff");
    act(() => useUi.getState().set({ ticketKind: "req", mappingBand: "low" }));
    fireEvent.keyDown(window, { code: "Escape" });
    await advance(0);
    expect(screen.queryByRole("region", { name: "Guided tour" })).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass("tour");
    expect(router.state.location.pathname).toBe("/personas");
    expect(useUi.getState()).toMatchObject({ ticketKind: "inc", mappingBand: null });
  });

  it("keys do nothing when the tour is not running", async () => {
    renderApp("/personas");
    await screen.findByRole("heading", { level: 2 });
    fireEvent.keyDown(window, { code: "ArrowRight" });
    expect(useTour.getState()).toMatchObject({ active: false, step: 0 });
  });

  it("CC button hides captions; exit button ends the tour", async () => {
    await startFrom("/personas");
    fireEvent.click(bar().getByRole("button", { name: "Show or hide captions" }));
    expect(document.body).toHaveClass("captionsoff");
    fireEvent.click(bar().getByRole("button", { name: "Exit tour" }));
    await advance(0);
    expect(useTour.getState().active).toBe(false);
    expect(document.body).not.toHaveClass("captionsoff");
  });

  it("ends by itself after the last step and returns to Personas", async () => {
    const { router } = await startFrom("/change");
    act(() => useTour.getState().go(17));
    await advance(0);
    await advance(TOUR[17].dur);
    expect(useTour.getState().active).toBe(false);
    expect(router.state.location.pathname).toBe("/personas");
  });
});
