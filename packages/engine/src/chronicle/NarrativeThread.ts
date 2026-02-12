import type { NarrativeThread } from "../types.ts";

export function createNarrativeThread(
  id: string,
  summary: string,
  initialTension: number = 3,
): NarrativeThread {
  return {
    id,
    summary,
    active: true,
    entries: [],
    tension: Math.max(0, Math.min(10, initialTension)),
  };
}

export function clampTension(value: number): number {
  return Math.max(0, Math.min(10, value));
}
