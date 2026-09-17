import type { AppException, Baseline, Device, Migration, PersonaDef, Weights } from "../types.ts";

/* Values match the wireframe's DEFAULT_BASELINE and WEIGHTS for DEV and KW. */
export const DEV_BASELINE: Baseline = {
  ramGB: 32,
  storageGB: 1024,
  cpuScore: 78,
  bootSec: 40,
  crashes: 2,
  freePct: 20,
  batteryPct: 75,
  ticketsPer100: 12,
};

export const KW_BASELINE: Baseline = {
  ramGB: 16,
  storageGB: 512,
  cpuScore: 55,
  bootSec: 45,
  crashes: 3,
  freePct: 15,
  batteryPct: 70,
  ticketsPer100: 9,
};

export const DEV_WEIGHTS: Weights = { prov: 30, perf: 30, comp: 15, exp: 10, sup: 15 };
export const KW_WEIGHTS: Weights = { prov: 20, perf: 20, comp: 25, exp: 15, sup: 20 };

export const DEV_PERSONA: PersonaDef = {
  id: "DEV",
  name: "Engineering",
  sub: "Software & platform build",
  count: 1000,
  hue: "#6E7BF2",
};

export const KW_PERSONA: PersonaDef = {
  id: "KW",
  name: "Knowledge Worker",
  sub: "Corporate functions",
  count: 6120,
  hue: "#2FA9C9",
};

export function device(overrides: Partial<Device> = {}): Device {
  return {
    id: "DEV-0001",
    host: "DEV-WKS-1000",
    user: "Aarav Sharma",
    email: "aarav.sharma@contoso.com",
    site: "Pune HQ",
    model: "Latitude 7450",
    ramGB: 32,
    storageGB: 1024,
    freePct: 20,
    cpuScore: 78,
    bootSec: 40,
    crashes: 2,
    batteryPct: 75,
    patched: true,
    osBuild: "Win11 24H2",
    lastSeen: 1,
    tickets: [],
    installed: [],
    ...overrides,
  };
}

/** Meets the DEV baseline exactly on every measure. */
export const onBaseline = device();

/** Half the DEV baseline on RAM, storage and CPU; slow, crashy, unpatched Windows 10. */
export const struggling = device({
  id: "DEV-0002",
  ramGB: 16,
  storageGB: 512,
  cpuScore: 39,
  bootSec: 80,
  crashes: 4,
  freePct: 10,
  batteryPct: 60,
  patched: false,
  osBuild: "Win10 22H2",
  tickets: [
    {
      number: "INC0041001",
      cat: "Performance",
      short: "Laptop extremely slow after patch",
      priority: "P2",
      state: "In Progress",
      group: "EUC-Desktop",
      ageDays: 5,
    },
  ],
  installed: ["Visual Studio Code"],
});

export const MIGRATIONS: Migration[] = [
  { from: "KW", to: "DEV", people: 96 },
  { from: "DEV", to: "DS", people: 10 },
];

export const EXCEPTIONS: AppException[] = [
  {
    id: "RITM1",
    user: "Divya Rao",
    persona: "DEV",
    app: "Genesys Cloud Desktop",
    reason: "Rota",
    state: "Pending",
    raised: 3,
  },
  {
    id: "RITM2",
    user: "Rohan Nair",
    persona: "DEV",
    app: "Tableau Desktop",
    reason: "Reports",
    state: "Approved",
    raised: 9,
  },
  {
    id: "RITM3",
    user: "Meera Iyer",
    persona: "KW",
    app: "Visual Studio Code",
    reason: "Scripts",
    state: "Pending",
    raised: 4,
  },
];
