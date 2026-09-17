import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimNum } from "../components/AnimNum.tsx";
import { Replay } from "../motion/clock.tsx";
import { ease, MOTION_WINDOW_MS, progress } from "../motion/timing.ts";
import { useUi } from "../store/ui.ts";
import { THEMES } from "../theme/themes.ts";
import { BarList, Donut, PersonaRing, WeekBars } from "./index.ts";

describe("timing", () => {
  it("maps elapsed time to 0–1 progress with delay", () => {
    expect(progress(0, 100, 500)).toBe(0);
    expect(progress(350, 100, 500)).toBe(0.5);
    expect(progress(900, 100, 500)).toBe(1);
    expect(progress(Infinity, 999, 1)).toBe(1);
  });

  it("uses cubic and back-out easing", () => {
    expect(ease.out(0)).toBe(0);
    expect(ease.out(1)).toBe(1);
    expect(ease.pop(0.6)).toBeGreaterThan(1);
  });
});

describe("animation clock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    useUi.setState({ motion: true });
  });
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  const barHeights = (container: HTMLElement) =>
    [...container.querySelectorAll("rect")].map((r) => Number(r.getAttribute("height")));

  it("grows bars from zero to their final height", () => {
    const { container } = render(<WeekBars series={[10, 20, 30]} color="#fff" />);
    expect(barHeights(container).every((h) => h === 0)).toBe(true);
    advance(300);
    const mid = barHeights(container);
    expect(mid[0]).toBeGreaterThan(0);
    advance(MOTION_WINDOW_MS);
    const done = barHeights(container);
    expect(done[2]).toBeGreaterThan(done[0]);
    expect(done.every((h, i) => h >= mid[i])).toBe(true);
  });

  it("counts numbers up and finishes on the exact value", () => {
    const { container } = render(<AnimNum value={12095} />);
    expect(container.textContent).toBe("0");
    advance(450);
    const mid = Number(container.textContent!.replace(/,/g, ""));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(12095);
    advance(MOTION_WINDOW_MS);
    expect(container.textContent).toBe("12,095");
  });

  it("shows new data immediately after the animation, without replaying", () => {
    const { container, rerender } = render(<AnimNum value={10} />);
    advance(MOTION_WINDOW_MS + 100);
    rerender(<AnimNum value={42} />);
    expect(container.textContent).toBe("42");
  });

  it("replays when the Replay key changes", () => {
    const { container, rerender } = render(
      <Replay on="a">
        <AnimNum value={500} />
      </Replay>,
    );
    advance(MOTION_WINDOW_MS + 100);
    expect(container.textContent).toBe("500");
    rerender(
      <Replay on="b">
        <AnimNum value={500} />
      </Replay>,
    );
    expect(container.textContent).toBe("0");
    advance(MOTION_WINDOW_MS + 100);
    expect(container.textContent).toBe("500");
  });

  it("draws final state at once when MOTION is off", () => {
    act(() => useUi.setState({ motion: false }));
    const { container } = render(<WeekBars series={[10, 20, 30]} color="#fff" />);
    expect(barHeights(container).every((h) => h > 0)).toBe(true);
  });

  it("respects the operating system's reduced-motion setting", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes("reduce"),
    })) as unknown as typeof window.matchMedia;
    try {
      const { container } = render(<AnimNum value={77} />);
      expect(container.textContent).toBe("77");
    } finally {
      window.matchMedia = original;
    }
  });

  it("animates bar list fills", () => {
    const { container } = render(<BarList rows={[{ k: "VPN drops", n: 4 }]} color="#fff" />);
    const fill = container.querySelector<HTMLElement>(".bar-fill")!;
    expect(fill.style.width).toBe("0%");
    advance(MOTION_WINDOW_MS);
    expect(fill.style.width).toBe("100%");
  });
});

describe("Donut", () => {
  const C = THEMES.midnight;
  const rows = [
    { key: "Hardware", n: 30, color: C.bad },
    { key: "Access", n: 10, color: C.good },
  ];

  it("shows the total and label in the middle", () => {
    render(<Donut rows={rows} centerLabel="TICKETS" />);
    const svg = screen.getByRole("img", { name: "tickets" });
    expect(within(svg).getByText("40")).toBeInTheDocument();
    expect(within(svg).getByText("TICKETS")).toBeInTheDocument();
  });

  it("makes slices buttons that select by click or keyboard", () => {
    const onSelect = vi.fn();
    render(<Donut rows={rows} centerLabel="TICKETS" onSelect={onSelect} active="Access" />);
    const hardware = screen.getByRole("button", { name: "Hardware: 30" });
    expect(hardware).toHaveAttribute("opacity", "0.22");
    expect(screen.getByRole("button", { name: "Access: 10" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(hardware);
    fireEvent.keyDown(hardware, { key: "Enter" });
    fireEvent.keyDown(hardware, { key: " " });
    fireEvent.keyDown(hardware, { key: "a" });
    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenCalledWith("Hardware");
  });

  it("has no buttons without onSelect", () => {
    render(<Donut rows={rows} centerLabel="DEVICES" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "devices" })).toBeInTheDocument();
  });

  it("is a group, not an image, when slices are buttons (an img hides its children from assistive tech)", () => {
    render(<Donut rows={rows} centerLabel="TICKETS" onSelect={() => {}} />);
    expect(screen.queryByRole("img", { name: "tickets" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "tickets" })).getAllByRole("button")).toHaveLength(2);
  });
});

describe("theme colours", () => {
  it("draws charts in the active theme", () => {
    act(() => useUi.setState({ theme: "daylight" }));
    const { container } = render(<PersonaRing pid="DEV" health={90} underPct={0.1} />);
    const fills = [...container.querySelectorAll("path")].map((p) => p.getAttribute("fill"));
    expect(fills).toContain(THEMES.daylight.good);
    expect(fills).toContain(THEMES.daylight.bad);
    expect(fills).not.toContain(THEMES.midnight.good);
  });
});
