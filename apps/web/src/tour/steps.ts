/* The guided tour script, copied from the wireframe. Durations are tuned to a
   150 wpm voiceover and match the narration line for line. A parity test
   compares this array with the wireframe's TOUR. */

export type TourView = "landing" | "baseline" | "tickets" | "movement";

export interface TourStep {
  kind?: "title";
  /** Milliseconds before auto-advancing. */
  dur: number;
  cap: string;
  sub?: string;
  eyebrow?: string;
  view?: TourView;
  /** Persona for the baseline view. */
  pid?: string;
  /** Index of the section heading (.sect) to scroll to. */
  scroll?: number;
  /** Mapping confidence band on the Personas page (null clears it). */
  cband?: "100" | "50" | "low" | null;
  /** Tickets page mode. */
  tmode?: "inc" | "req";
}

export const TOUR: readonly TourStep[] = [
  { kind: "title", dur: 5000, cap: "Persona Fleet Command", sub: "ENDPOINT EXPERIENCE PORTAL" },

  /* ---- ACT ONE · WHO ---- */
  {
    view: "landing",
    dur: 13000,
    eyebrow: "01 · PERSONAS",
    cap: "Every persona in the estate, one ring each. The outer arc is persona health, the inner red arc is the share of devices sitting below their baseline.",
  },
  {
    view: "landing",
    dur: 10000,
    eyebrow: "01 · PERSONAS",
    cap: "Four numbers set the scale: seven personas, twelve thousand devices, how many fall short, and what that is costing in open tickets.",
  },
  {
    view: "landing",
    scroll: 0,
    dur: 14000,
    eyebrow: "01 · MAPPING CONFIDENCE",
    cap: "Before any of that means anything, people have to be in the right persona. Every job title is mapped by model, and every mapping carries a confidence score.",
  },
  {
    view: "landing",
    scroll: 0,
    cband: "low",
    dur: 13000,
    eyebrow: "01 · MAPPING CONFIDENCE",
    cap: "Three bands make the workload obvious. Under fifty per cent needs a human, because a weak mapping puts the wrong baseline on a real device.",
  },
  {
    view: "landing",
    scroll: 1,
    cband: "low",
    dur: 12000,
    eyebrow: "01 · REVIEW QUEUE",
    cap: "The queue underneath names the title, the department, the persona it was mapped to, and why it was flagged. Contact Centre and Field Engineer carry most of it.",
  },

  /* ---- ACT TWO · WHAT THEY GET ---- */
  {
    view: "baseline",
    pid: "DEV",
    cband: null,
    scroll: 0,
    dur: 13000,
    eyebrow: "02 · WHERE THE FLEET STANDS",
    cap: "Second act. Before the contract itself, the headline: how much of the fleet is a fit, how much is under-provisioned, how much is over-provisioned spend, and how much is critically mismatched.",
  },
  {
    view: "baseline",
    pid: "DEV",
    scroll: 1,
    dur: 14000,
    eyebrow: "02 · THE CONTRACT",
    cap: "Each persona has a contract: minimum memory, storage, CPU, boot time, and a ceiling on tickets. Every number in this portal is measured against it.",
  },
  {
    view: "baseline",
    pid: "DS",
    scroll: 1,
    dur: 14000,
    eyebrow: "02 · LIVE IMPACT",
    cap: "Change a value and the whole portal recalculates. The panel on the right prices the change immediately, so a refresh programme can be sized before budget is committed.",
  },
  {
    view: "baseline",
    pid: "DEV",
    scroll: 2,
    dur: 14000,
    eyebrow: "02 · WHY IT MISSES",
    cap: "Split by persona, the shape of the miss is obvious. Over-provisioning costs money; critical mismatch costs productivity, and the two do not land on the same personas.",
  },
  {
    view: "baseline",
    pid: "CC",
    scroll: 3,
    dur: 13000,
    eyebrow: "02 · WHICH COMPONENT",
    cap: "The heat table shows which component fails for which persona. The personas with the weakest mapping are the same ones failing here — that is not a coincidence.",
  },

  /* ---- ACT THREE · WHAT IT COSTS ---- */
  {
    view: "tickets",
    dur: 14000,
    eyebrow: "03 · TICKETS",
    cap: "And this is what it costs to run. Incident volume, how many people raised it, and the load per user against each persona's ticket ceiling.",
  },
  {
    view: "tickets",
    scroll: 0,
    dur: 13000,
    eyebrow: "03 · DISTRIBUTION",
    cap: "What is breaking, which departments carry it, when it arrived, and how it is ageing by priority. A tall right-hand bar means things are ageing, not arriving.",
  },
  {
    view: "tickets",
    scroll: 1,
    dur: 15000,
    eyebrow: "03 · PERSONA TICKET HEALTH",
    cap: "The summary closes the loop. Contact Centre and Field Engineer are over their ceiling — the same two personas with the weakest mapping and the worst device fit.",
  },
  {
    view: "tickets",
    tmode: "req",
    dur: 13000,
    eyebrow: "03 · SERVICE REQUESTS",
    cap: "One switch moves the page to service requests. Repeated memory and storage requests are not a support problem — they are a baseline set too low.",
  },

  /* ---- ACT FOUR · WHAT IS SHIFTING ---- */
  {
    view: "movement",
    tmode: "inc",
    dur: 14000,
    eyebrow: "04 · CHANGE",
    cap: "Finally, what is shifting. Where people moved this quarter, and which applications are most often requested outside a persona.",
  },
  {
    view: "movement",
    dur: 11000,
    eyebrow: "04 · CHANGE",
    cap: "A repeat request usually means the catalogue is wrong, not the person. Which takes you straight back to the persona definition.",
  },

  /* ---- CLOSE ---- */
  {
    view: "landing",
    dur: 12000,
    eyebrow: "END TO END",
    cap: "Mapping decides the persona. The persona sets the baseline. The baseline grades the device. The device drives the tickets. One story, four screens.",
  },
];

/** Route for a tour step's screen. */
export function tourPath(step: TourStep): string | null {
  switch (step.view) {
    case "landing":
      return "/personas";
    case "baseline":
      return `/baselines/${step.pid ?? "DEV"}`;
    case "tickets":
      return "/tickets";
    case "movement":
      return "/change";
    default:
      return null;
  }
}

/** The wireframe's "same screen" test: only the overlay changes, the page is not redrawn or scrolled to the top. */
export function sameScreen(prev: TourStep | undefined, step: TourStep): boolean {
  if (!prev || step.kind === "title" || prev.kind === "title") return false;
  return (
    prev.view === step.view && prev.pid === step.pid && prev.cband === step.cband && prev.tmode === step.tmode
  );
}
