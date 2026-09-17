/* 12-week persona health trend, as the wireframe draws it: seeded per persona
   and anchored to today's health, so it moves when a baseline moves. */
import { mulberry32 } from "./random.ts";

export function personaTrend(pid: string, health: number): number[] {
  const r = mulberry32(pid.charCodeAt(0) * 97);
  return Array.from({ length: 13 }, (_, i) =>
    Math.round(health - (12 - i) * (r() * 1.1 - 0.35) - (12 - i) * 0.4),
  );
}
