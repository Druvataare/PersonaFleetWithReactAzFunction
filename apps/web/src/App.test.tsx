import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CHECKS } from "./apiChecks.ts";
import App from "./App.tsx";

describe("App", () => {
  it("renders the product name and the linked scoring package", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Persona Fleet Command" })).toBeInTheDocument();
    expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });

  it("calls every mock endpoint successfully", async () => {
    render(<App />);
    const table = screen.getByRole("table");
    expect(await within(table).findAllByText("OK")).toHaveLength(CHECKS.length);
    expect(within(table).queryByText("Failed")).not.toBeInTheDocument();
    expect(within(table).getByText("7 personas · 12,095 devices in estate")).toBeInTheDocument();
    expect(within(table).getByText(/2,063 incidents/)).toBeInTheDocument();
  });
});
