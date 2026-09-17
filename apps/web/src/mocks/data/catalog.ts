/* Static reference data from the wireframe. Object key order matters:
   the generator iterates APPS and weight maps in declaration order. */
import type { Baseline, Migration, PersonaId, Weights } from "@pfc/scoring";
import { CATALOG, TICKET_CATS } from "../../lib/categories.ts";

export { CATALOG, TICKET_CATS };

export const SEED = 20260815;

export const HUE: Record<PersonaId, string> = {
  DEV: "#6E7BF2",
  KW: "#2FA9C9",
  CC: "#22A57F",
  FIELD: "#D98429",
  EXEC: "#C4649B",
  DS: "#9B5FE0",
  CRE: "#7C6BE8",
};

export const APPS: Record<PersonaId, string[]> = {
  DEV: [
    "Visual Studio Code",
    "Docker Desktop",
    "GitHub Copilot",
    "Postman",
    "WSL2 Toolchain",
    "IntelliJ IDEA",
  ],
  EXEC: ["Power BI Desktop", "Board Portal", "DocuSign", "Zoom Rooms Controller"],
  FIELD: ["Field Service Mobile", "ArcGIS Runtime", "Offline Map Pack", "Rugged Diagnostics"],
  CC: ["Genesys Cloud Desktop", "CRM Agent Console", "Call Screen Recorder", "Knowledge Assist"],
  KW: ["Microsoft 365 Apps", "Visio", "Project", "Company Portal"],
  DS: ["Anaconda Distribution", "Databricks CLI", "Tableau Desktop", "CUDA Toolkit", "Fabric Notebook Sync"],
  CRE: ["Adobe Creative Cloud", "Figma Desktop", "Blender", "Colour Calibrator"],
};

/** `count` is headcount: people / devices in the persona. */
export const PERSONA_DEFS: ReadonlyArray<{ id: PersonaId; name: string; sub: string; count: number }> = [
  { id: "DEV", name: "Engineering", sub: "Software & platform build", count: 1840 },
  { id: "KW", name: "Knowledge Worker", sub: "Corporate functions", count: 6120 },
  { id: "CC", name: "Contact Centre", sub: "Service desk & sales", count: 2450 },
  { id: "FIELD", name: "Field Engineer", sub: "On-site & rugged", count: 980 },
  { id: "EXEC", name: "Executive", sub: "Leadership & board", count: 210 },
  { id: "DS", name: "Data Science", sub: "Modelling & analytics", count: 340 },
  { id: "CRE", name: "Creative Studio", sub: "Brand, video & 3D", count: 155 },
];

export const DEFAULT_BASELINE: Record<PersonaId, Baseline> = {
  DEV: {
    ramGB: 32,
    storageGB: 1024,
    cpuScore: 78,
    bootSec: 40,
    crashes: 2,
    freePct: 20,
    batteryPct: 75,
    ticketsPer100: 12,
  },
  KW: {
    ramGB: 16,
    storageGB: 512,
    cpuScore: 55,
    bootSec: 45,
    crashes: 3,
    freePct: 15,
    batteryPct: 70,
    ticketsPer100: 9,
  },
  CC: {
    ramGB: 16,
    storageGB: 256,
    cpuScore: 50,
    bootSec: 50,
    crashes: 3,
    freePct: 15,
    batteryPct: 65,
    ticketsPer100: 14,
  },
  FIELD: {
    ramGB: 16,
    storageGB: 512,
    cpuScore: 58,
    bootSec: 45,
    crashes: 3,
    freePct: 18,
    batteryPct: 80,
    ticketsPer100: 16,
  },
  EXEC: {
    ramGB: 32,
    storageGB: 1024,
    cpuScore: 70,
    bootSec: 35,
    crashes: 1,
    freePct: 25,
    batteryPct: 85,
    ticketsPer100: 6,
  },
  DS: {
    ramGB: 64,
    storageGB: 2048,
    cpuScore: 88,
    bootSec: 40,
    crashes: 2,
    freePct: 25,
    batteryPct: 70,
    ticketsPer100: 11,
  },
  CRE: {
    ramGB: 64,
    storageGB: 2048,
    cpuScore: 85,
    bootSec: 40,
    crashes: 2,
    freePct: 25,
    batteryPct: 70,
    ticketsPer100: 10,
  },
};

export const WEIGHTS: Record<PersonaId, Weights> = {
  DEV: { prov: 30, perf: 30, comp: 15, exp: 10, sup: 15 },
  KW: { prov: 20, perf: 20, comp: 25, exp: 15, sup: 20 },
  CC: { prov: 20, perf: 25, comp: 20, exp: 10, sup: 25 },
  FIELD: { prov: 20, perf: 15, comp: 20, exp: 30, sup: 15 },
  EXEC: { prov: 25, perf: 25, comp: 20, exp: 20, sup: 10 },
  DS: { prov: 35, perf: 30, comp: 15, exp: 10, sup: 10 },
  CRE: { prov: 35, perf: 30, comp: 15, exp: 10, sup: 10 },
};

export const MODELS: Record<PersonaId, string[]> = {
  DEV: ["Latitude 7450", "EliteBook 860 G11", "ThinkPad P14s"],
  KW: ["Latitude 5450", "EliteBook 640 G11", "ThinkPad L14"],
  CC: ["OptiPlex 7010 SFF", "Latitude 3450"],
  FIELD: ["Latitude 7030 Rugged", "ToughBook FZ-55"],
  EXEC: ["XPS 14", "Surface Laptop 7", "MacBook Pro 14"],
  DS: ["Precision 5690", "ZBook Studio G11"],
  CRE: ["Precision 7690", "MacBook Pro 16"],
};

export const FIRST = [
  "Aarav",
  "Meera",
  "Rohan",
  "Priya",
  "Ishaan",
  "Neha",
  "Kabir",
  "Ananya",
  "Vikram",
  "Sana",
  "Arjun",
  "Divya",
  "Farhan",
  "Riya",
  "Nikhil",
  "Tara",
  "Omar",
  "Leah",
  "Marcus",
  "Chen",
];
export const LAST = [
  "Sharma",
  "Iyer",
  "Kapoor",
  "Nair",
  "Bose",
  "Reddy",
  "Malhotra",
  "Verma",
  "Sinha",
  "DSouza",
  "Khan",
  "Patel",
  "Rao",
  "Menon",
  "Gill",
  "Wu",
  "Novak",
  "Okafor",
  "Silva",
  "Haruna",
];
export const SITES = ["Pune HQ", "Bengaluru", "Hyderabad", "London", "Austin", "Krakow", "Remote"];

export const TICKET_TITLES: Record<string, string[]> = {
  Performance: [
    "Laptop extremely slow after patch",
    "High memory usage, apps freezing",
    "Boot time over 3 minutes",
  ],
  Hardware: [
    "Battery drains within 90 minutes",
    "Docking station not detected",
    "Keyboard keys unresponsive",
  ],
  Application: [
    "Build tooling crashes on launch",
    "Add-in fails to load",
    "Licence not applied after install",
  ],
  Access: ["Cannot access persona app catalogue", "MFA loop on sign-in", "Shared drive permission denied"],
  Connectivity: ["VPN drops every 10 minutes", "Wi-Fi disconnects at site", "Poor call quality on softphone"],
  Provisioning: [
    "Request additional RAM for build workloads",
    "Storage upgrade for model artefacts",
    "Persona change - device not reimaged",
  ],
};

/** Share of sample devices provisioned below their persona contract. */
export const UNDER_RATE: Record<PersonaId, number> = {
  CC: 0.46,
  FIELD: 0.4,
  DS: 0.24,
  CRE: 0.2,
  KW: 0.2,
  DEV: 0.13,
  EXEC: 0.09,
};

/** Sample rows per persona (headcount is scaled from these). */
export const SAMPLE_SIZE = (pid: PersonaId): number => (pid === "KW" ? 34 : pid === "CC" ? 28 : 24);

export const MIGRATIONS: readonly Migration[] = [
  { from: "KW", to: "DS", people: 148 },
  { from: "DEV", to: "DS", people: 96 },
  { from: "KW", to: "CRE", people: 62 },
  { from: "CC", to: "KW", people: 74 },
  { from: "KW", to: "FIELD", people: 41 },
  { from: "FIELD", to: "KW", people: 28 },
  { from: "CC", to: "DEV", people: 19 },
];

export const REASONS = [
  "Covers a second role part-time",
  "Supports an escalation rota",
  "Owns a reporting pack for leadership",
  "Runs a cross-team tool nobody else maintains",
  "Legacy process not yet migrated",
  "Client deliverable requires it",
  "Trialling ahead of a catalogue change",
  "Inherited from a previous team",
];

/** Hand-written exceptions that lead the list. */
export const NAMED_EXCEPTIONS = [
  {
    id: "RITM0049211",
    user: "Meera Iyer",
    persona: "KW",
    app: "Visual Studio Code",
    reason: "Maintains reporting scripts for finance close",
    state: "Approved",
    raised: 4,
  },
  {
    id: "RITM0049233",
    user: "Kabir Khan",
    persona: "CC",
    app: "Power BI Desktop",
    reason: "Builds queue dashboards for team leads",
    state: "Pending",
    raised: 7,
  },
  {
    id: "RITM0049240",
    user: "Tara Menon",
    persona: "FIELD",
    app: "Adobe Creative Cloud",
    reason: "Produces site survey photo reports",
    state: "Pending",
    raised: 2,
  },
  {
    id: "RITM0049255",
    user: "Marcus Novak",
    persona: "EXEC",
    app: "Tableau Desktop",
    reason: "Reviews commercial models before board pack",
    state: "Approved",
    raised: 11,
  },
  {
    id: "RITM0049261",
    user: "Divya Rao",
    persona: "DEV",
    app: "Genesys Cloud Desktop",
    reason: "Supports agent tooling escalations on rota",
    state: "Approved",
    raised: 15,
  },
  {
    id: "RITM0049272",
    user: "Farhan Gill",
    persona: "KW",
    app: "CUDA Toolkit",
    reason: "Trialling local inference, no GPU assigned",
    state: "Rejected",
    raised: 19,
  },
] as const;

/** Generated exceptions per persona, in generation order. */
export const EXCEPTION_WEIGHT: Record<PersonaId, number> = {
  KW: 16,
  CC: 10,
  DEV: 8,
  FIELD: 6,
  DS: 5,
  CRE: 3,
  EXEC: 2,
};

export const DEPTS: Record<PersonaId, string[]> = {
  DEV: ["Platform Engineering", "Product Engineering", "QA & Release", "DevOps", "Architecture"],
  KW: ["Finance", "Human Resources", "Legal", "Marketing", "Procurement", "Operations"],
  CC: ["Customer Service", "Inside Sales", "Retention", "Billing Support"],
  FIELD: ["Field Operations", "Installations", "Maintenance", "Site Survey"],
  EXEC: ["Executive Office", "Strategy", "Board Affairs"],
  DS: ["Data Science", "Advanced Analytics", "AI Research"],
  CRE: ["Brand Studio", "Video Production", "3D & Motion"],
};

export const ROLES: Record<PersonaId, string[]> = {
  DEV: [
    "Software Engineer",
    "Backend Developer",
    "Frontend Developer",
    "Platform Engineer",
    "Release Engineer",
    "Test Automation Engineer",
    "Site Reliability Engineer",
    "Build Engineer",
  ],
  KW: [
    "Analyst",
    "Coordinator",
    "Business Partner",
    "Specialist",
    "Administrator",
    "Manager",
    "Officer",
    "Consultant",
  ],
  CC: [
    "Service Advisor",
    "Support Agent",
    "Team Coach",
    "Retention Agent",
    "Billing Advisor",
    "Queue Supervisor",
  ],
  FIELD: [
    "Field Engineer",
    "Installation Technician",
    "Maintenance Technician",
    "Survey Engineer",
    "Site Lead",
  ],
  EXEC: ["Director", "Vice President", "Chief of Staff", "Head of Function", "Managing Director"],
  DS: ["Data Scientist", "ML Engineer", "Analytics Engineer", "Research Scientist", "Statistician"],
  CRE: ["Designer", "Motion Artist", "Video Editor", "3D Artist", "Art Director"],
};

export const GRADES = ["Associate", "Junior", "", "", "Senior", "Lead", "Principal", "Staff"];
export const SUFFIX = [
  "",
  "",
  "I",
  "II",
  "III",
  "IV",
  "(Grade 1)",
  "(Grade 2)",
  "- Tier 1",
  "- Tier 2",
  "- EMEA",
  "- APAC",
  "- Americas",
];
export const LOW_REASON = [
  "Title text too short to classify",
  "Free-text title, no catalogue match",
  "Title maps to two personas equally",
  "Contractor title not in HR feed",
  "Legacy title from acquired entity",
  "Abbreviation not recognised",
];

/** Share of job titles mapped with less than full confidence, per persona. */
export const MISMAP: Record<PersonaId, number> = {
  DEV: 0.004,
  KW: 0.012,
  CC: 0.035,
  FIELD: 0.03,
  EXEC: 0.001,
  DS: 0.005,
  CRE: 0.01,
};

export const REQ_TITLES: Record<string, string[]> = {
  "Laptop Request": ["New starter laptop", "Replacement for damaged unit", "Loan device for travel"],
  "Software Install": ["Install licensed design suite", "Add analytics package", "Reinstall build tooling"],
  "VPN Access": ["VPN profile for new site", "Split-tunnel exception", "VPN re-enable after leave"],
  "Email Access": ["Shared mailbox access", "Distribution list membership", "Delegate access request"],
  "Access Request": [
    "Access to persona app catalogue",
    "Elevated rights for install",
    "Folder permission request",
  ],
  "Peripheral Request": ["Second monitor", "Docking station", "Headset for call handling"],
  "Storage Upgrade": ["Disk upgrade for artefacts", "Additional local storage", "Storage for media capture"],
  "Memory Upgrade": [
    "RAM upgrade for build workloads",
    "Memory for model training",
    "Memory for editing suite",
  ],
};
export const INC_GROUPS = ["EUC-Desktop", "EUC-Provisioning", "Network-Ops", "App-Support"];
export const REQ_GROUPS = ["EUC-Provisioning", "EUC-Desktop", "Identity-Access", "Procurement"];

/** Incidents and requests raised per user, per persona. */
export const INC_RATE: Record<PersonaId, number> = {
  DEV: 0.1,
  KW: 0.11,
  CC: 0.3,
  FIELD: 0.42,
  EXEC: 0.04,
  DS: 0.09,
  CRE: 0.13,
};
export const REQ_RATE: Record<PersonaId, number> = {
  DEV: 0.22,
  KW: 0.08,
  CC: 0.11,
  FIELD: 0.19,
  EXEC: 0.05,
  DS: 0.16,
  CRE: 0.14,
};

/** Tasks automated per week and days to be ready, per persona standard build. */
export const TASKS_AUTO: Record<PersonaId, number> = {
  DEV: 14,
  KW: 8,
  CC: 11,
  FIELD: 6,
  EXEC: 5,
  DS: 16,
  CRE: 9,
};
export const ONBOARD_DAYS: Record<PersonaId, number> = {
  DEV: 3,
  KW: 1,
  CC: 1,
  FIELD: 4,
  EXEC: 2,
  DS: 3,
  CRE: 3,
};
