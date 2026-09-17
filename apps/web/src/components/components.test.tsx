import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUi } from "../store/ui.ts";
import { formatNum, toneColor } from "../lib/format.ts";
import { AnimNum } from "./AnimNum.tsx";
import { Avatar } from "./Avatar.tsx";
import { Icon } from "./Icon.tsx";
import { Kpi } from "./ui.tsx";

describe("Avatar", () => {
  it.each(["DEV", "KW", "CC", "FIELD", "EXEC", "DS", "CRE"])("draws head, body and a %s prop", (pid) => {
    const { container } = render(<Avatar pid={pid} size={44} color="#123456" />);
    const shapes = container.querySelectorAll("circle, path, rect");
    expect(shapes.length).toBeGreaterThan(2);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 44 44");
  });

  it("scales geometry with size and exposes a label when titled", () => {
    render(<Avatar pid="DEV" size={22} title="Engineering" />);
    const svg = screen.getByRole("img", { name: "Engineering" });
    expect(svg.querySelector("circle")).toHaveAttribute("r", "3.5");
  });
});

describe("Icon", () => {
  it("renders a hidden decorative svg", () => {
    const { container } = render(<Icon name="ticket" size={18} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg.innerHTML).toContain("<path");
  });
});

describe("AnimNum", () => {
  it("formats integers with separators and decimals with fixed places", () => {
    expect(formatNum(12095)).toBe("12,095");
    expect(formatNum(99.2015, 2)).toBe("99.20");
    expect(formatNum(4.6)).toBe("5");
  });

  it("shows the final value immediately when motion is off, and updates", () => {
    const { container, rerender } = render(<AnimNum value={1840} pre="+" suf=" people" />);
    expect(container.textContent).toBe("+1,840 people");
    rerender(<AnimNum value={12} pre="+" suf=" people" />);
    expect(container.textContent).toBe("+12 people");
  });

  it("starts from zero when motion is on", () => {
    act(() => useUi.setState({ motion: true }));
    const { container } = render(<AnimNum value={500} />);
    expect(container.textContent).toBe("0");
  });
});

describe("Kpi", () => {
  it("labels the group and colours the value by tone", () => {
    render(<Kpi value={42} label="Under baseline" tone="bad" suf="%" />);
    const group = screen.getByRole("group", { name: "Under baseline" });
    expect(group).toHaveTextContent("42%");
    expect(group.querySelector(".stat-v")).toHaveStyle({ color: "var(--bad)" });
    expect(toneColor(undefined)).toBe("var(--text)");
  });
});
