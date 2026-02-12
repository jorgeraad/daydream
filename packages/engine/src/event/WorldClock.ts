import type { TimeOfDay } from "../types.ts";

export class WorldClock {
  private currentTime: number; // total game-minutes since world creation
  private gameMinutesPerRealSecond: number;

  constructor(options?: {
    gameMinutesPerRealSecond?: number;
    startTime?: number;
  }) {
    this.gameMinutesPerRealSecond = options?.gameMinutesPerRealSecond ?? 2;
    // Default start: 8:00 AM (480 minutes into the day)
    this.currentTime = options?.startTime ?? 480;
  }

  advance(realDeltaMs: number): void {
    const realSeconds = realDeltaMs / 1000;
    this.currentTime += realSeconds * this.gameMinutesPerRealSecond;
  }

  getTimeOfDay(): TimeOfDay {
    const hour = this.getHour();
    if (hour >= 5 && hour < 7) return "dawn";
    if (hour >= 7 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 19) return "dusk";
    if (hour >= 19 && hour < 22) return "evening";
    return "night";
  }

  getDayNumber(): number {
    return Math.floor(this.currentTime / 1440) + 1;
  }

  getHour(): number {
    return Math.floor((this.currentTime % 1440) / 60);
  }

  getMinute(): number {
    return Math.floor(this.currentTime % 60);
  }

  getGameTime(): number {
    return this.currentTime;
  }

  setGameTime(minutes: number): void {
    this.currentTime = minutes;
  }
}
