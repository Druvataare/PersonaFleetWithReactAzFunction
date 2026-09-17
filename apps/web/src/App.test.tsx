import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App.tsx";

describe("App", () => {
  it("renders the product name and the linked scoring package", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Persona Fleet Command" })).toBeInTheDocument();
    expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });
});
