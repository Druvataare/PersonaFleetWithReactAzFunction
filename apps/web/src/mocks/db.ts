/* In-memory mock database. Created lazily from the seeded generator and
   mutated by write endpoints (persona changes). Resets on page reload. */
import type { PersonaChange } from "../api/types.ts";
import { generateFleetData, type FleetData } from "./data/generate.ts";

export interface MockDb extends FleetData {
  switches: PersonaChange[];
}

let current: MockDb | null = null;

export function db(): MockDb {
  current ??= { ...generateFleetData(), switches: [] };
  return current;
}

/** Discards all changes; the next call to db() regenerates the seed data. */
export function resetDb(): void {
  current = null;
}
