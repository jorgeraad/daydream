/**
 * PlayerDetector — detects available CLI audio players on the system.
 *
 * Checks for players in priority order: mpv > mpg123 > afplay > aplay.
 * Returns the first available player's info, or null if none is found.
 * Detection runs once at startup; the result is cached.
 */

/** Information about a CLI audio player and how to invoke it. */
export interface PlayerInfo {
  /** The binary name (e.g., "mpv", "afplay"). */
  binary: string;
  /** CLI flags for native looping, or null if looping requires re-spawning. */
  loopFlag: string[] | null;
  /** Returns CLI flags to set playback volume (0-1 range). */
  volumeFlag: (v: number) => string[];
  /** Audio formats this player supports. */
  formats: string[];
}

/** Ordered list of CLI audio players, from most to least preferred. */
export const PLAYER_PRIORITY: PlayerInfo[] = [
  {
    binary: "mpv",
    loopFlag: ["--loop=inf"],
    volumeFlag: (v) => [`--volume=${Math.round(v * 100)}`],
    formats: ["wav", "mp3", "ogg", "flac"],
  },
  {
    binary: "mpg123",
    loopFlag: ["--loop", "0"],
    volumeFlag: (v) => ["--scale", String(Math.round(v * 32768))],
    formats: ["mp3"],
  },
  {
    binary: "afplay",
    loopFlag: null,
    volumeFlag: (v) => ["-v", String(v)],
    formats: ["wav", "mp3", "aac", "aiff"],
  },
  {
    binary: "aplay",
    loopFlag: null,
    volumeFlag: () => [],
    formats: ["wav"],
  },
];

/**
 * Check whether a binary exists on the system PATH.
 * Uses `which` to locate the binary. Override `spawnFn` for testing.
 */
export function isBinaryAvailable(
  binary: string,
  spawnFn: (args: string[]) => { exitCode: number } = (args) =>
    Bun.spawnSync(args),
): boolean {
  const result = spawnFn(["which", binary]);
  return result.exitCode === 0;
}

/**
 * Detect the best available CLI audio player on this system.
 *
 * Checks players in priority order and returns the first one found.
 * Returns null if no supported audio player is available.
 *
 * @param spawnFn - Override for testing (replaces Bun.spawnSync calls)
 */
export function detectPlayer(
  spawnFn?: (args: string[]) => { exitCode: number },
): PlayerInfo | null {
  for (const candidate of PLAYER_PRIORITY) {
    if (isBinaryAvailable(candidate.binary, spawnFn)) {
      return candidate;
    }
  }
  return null;
}
