import { describe, expect, it } from "vitest";
import { applyTheme, isThemeKey, THEME_KEYS, THEMES } from "./themes.ts";

describe("themes", () => {
  it("has the wireframe's seven themes with a complete palette each", () => {
    expect(THEME_KEYS).toEqual(["midnight", "carbon", "nord", "ember", "teal", "daylight", "parchment"]);
    const fields = Object.keys(THEMES.midnight).sort();
    THEME_KEYS.forEach((k) => expect(Object.keys(THEMES[k]).sort(), k).toEqual(fields));
  });

  it("validates theme keys", () => {
    expect(isThemeKey("ember")).toBe(true);
    expect(isThemeKey("neon")).toBe(false);
    expect(isThemeKey(undefined)).toBe(false);
  });

  it("writes CSS variables and colour scheme to the root", () => {
    const root = document.createElement("div");
    applyTheme("parchment", root);
    expect(root.style.getPropertyValue("--bg")).toBe("#F6F2EA");
    expect(root.style.getPropertyValue("--line-soft")).toBe("#E9E2D5");
    expect(root.style.colorScheme).toBe("light");
    applyTheme("teal", root);
    expect(root.style.getPropertyValue("--accent")).toBe("#5AD1C8");
    expect(root.style.colorScheme).toBe("dark");
  });
});
