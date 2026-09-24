import { describe, expect, it } from "vitest";
import { buildDevices, type DeviceAppRow, type DeviceRow, type DeviceTicketRow } from "./devices.ts";

const row = (over: Partial<DeviceRow> = {}): DeviceRow => ({
  id: "d1",
  personaId: "DEV",
  host: "LT-0001",
  user: "Ada Lovelace",
  email: "ada@example.com",
  site: "Bengaluru",
  model: "Latitude 5540",
  ramGB: 32,
  storageGB: 1024,
  freePct: 40,
  cpuScore: 88,
  bootSec: 35,
  crashes: 1,
  batteryPct: 90,
  patched: true,
  osBuild: "Win11 24H2",
  lastSeen: 1,
  missingMeasures: null,
  ...over,
});

const ticket = (over: Partial<DeviceTicketRow> = {}): DeviceTicketRow => ({
  deviceId: "d1",
  number: "job-1",
  cat: "OneDrive sync",
  short: "Sync stalled",
  priority: "P2",
  state: "ESCALATED",
  group: "agent-a",
  ageDays: 4,
  ...over,
});

describe("buildDevices", () => {
  it("groups devices by persona and attaches their tickets and apps", () => {
    const devices = buildDevices(
      [row(), row({ id: "d2", personaId: "EXEC", host: "LT-0002" })],
      [ticket(), ticket({ number: "job-2", ageDays: 2 })],
      [
        { deviceId: "d1", app: "Visual Studio Code" },
        { deviceId: "d1", app: "Docker Desktop" },
      ] satisfies DeviceAppRow[],
    );

    expect(Object.keys(devices).sort()).toEqual(["DEV", "EXEC"]);
    expect(devices.DEV[0].tickets.map((t) => t.number)).toEqual(["job-1", "job-2"]);
    expect(devices.DEV[0].installed).toEqual(["Visual Studio Code", "Docker Desktop"]);
    /* The ticket row's deviceId is a join key, not part of the contract. */
    expect(devices.DEV[0].tickets[0]).not.toHaveProperty("deviceId");
  });

  it("gives a device with no tickets or apps empty arrays, never undefined", () => {
    const devices = buildDevices([row({ id: "quiet" })], [], []);
    expect(devices.DEV[0].tickets).toEqual([]);
    expect(devices.DEV[0].installed).toEqual([]);
  });

  /* The heart of step 7: absent telemetry must not read as a bad measurement.
     Each substitution is the value that scores 100 against any baseline, so a
     device is never penalised for data nobody collected. */
  it("neutralises missing telemetry instead of letting it score as zero", () => {
    const devices = buildDevices(
      [row({ id: "desktop", freePct: null, bootSec: null, crashes: null, batteryPct: null })],
      [],
      [],
    );
    const d = devices.DEV[0];
    expect(d.freePct).toBe(100);
    expect(d.bootSec).toBe(0);
    expect(d.crashes).toBe(0);
    expect(d.batteryPct).toBe(100);
  });

  it("keeps a real zero, which means measured, distinct from a missing one", () => {
    /* A device genuinely at 0% free disk is in trouble and must score as such;
       only null is neutralised. */
    const devices = buildDevices([row({ freePct: 0, batteryPct: 0 })], [], []);
    expect(devices.DEV[0].freePct).toBe(0);
    expect(devices.DEV[0].batteryPct).toBe(0);
  });

  it("preserves the order the database returned", () => {
    const devices = buildDevices(
      [row({ id: "a", host: "LT-0001" }), row({ id: "b", host: "LT-0002" })],
      [],
      [],
    );
    expect(devices.DEV.map((d) => d.host)).toEqual(["LT-0001", "LT-0002"]);
  });
});
