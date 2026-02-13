import { describe, expect, it } from "bun:test";
import {
  detectPlayer,
  isBinaryAvailable,
  PLAYER_PRIORITY,
} from "../PlayerDetector.ts";

/** Create a mock spawnFn that reports specific binaries as available. */
function mockSpawn(available: string[]) {
  return (args: string[]) => {
    // args[0] is "which", args[1] is the binary name
    const binary = args[1] ?? "";
    return { exitCode: available.includes(binary) ? 0 : 1 };
  };
}

describe("PLAYER_PRIORITY", () => {
  it("has mpv as highest priority", () => {
    expect(PLAYER_PRIORITY[0]!.binary).toBe("mpv");
  });

  it("has mpg123 as second priority", () => {
    expect(PLAYER_PRIORITY[1]!.binary).toBe("mpg123");
  });

  it("has afplay as third priority", () => {
    expect(PLAYER_PRIORITY[2]!.binary).toBe("afplay");
  });

  it("has aplay as lowest priority", () => {
    expect(PLAYER_PRIORITY[3]!.binary).toBe("aplay");
  });

  it("mpv and mpg123 have native loop flags", () => {
    expect(PLAYER_PRIORITY[0]!.loopFlag).toEqual(["--loop=inf"]);
    expect(PLAYER_PRIORITY[1]!.loopFlag).toEqual(["--loop", "0"]);
  });

  it("afplay and aplay have no native loop flag (require re-spawn)", () => {
    expect(PLAYER_PRIORITY[2]!.loopFlag).toBeNull();
    expect(PLAYER_PRIORITY[3]!.loopFlag).toBeNull();
  });
});

describe("isBinaryAvailable", () => {
  it("returns true when binary is found", () => {
    const spawn = mockSpawn(["mpv"]);
    expect(isBinaryAvailable("mpv", spawn)).toBe(true);
  });

  it("returns false when binary is not found", () => {
    const spawn = mockSpawn([]);
    expect(isBinaryAvailable("mpv", spawn)).toBe(false);
  });

  it("passes correct args to spawn function", () => {
    let capturedArgs: string[] = [];
    const spawn = (args: string[]) => {
      capturedArgs = args;
      return { exitCode: 0 };
    };
    isBinaryAvailable("afplay", spawn);
    expect(capturedArgs).toEqual(["which", "afplay"]);
  });
});

describe("detectPlayer", () => {
  it("returns mpv when it is available", () => {
    const spawn = mockSpawn(["mpv", "afplay"]);
    const result = detectPlayer(spawn);
    expect(result).not.toBeNull();
    expect(result!.binary).toBe("mpv");
  });

  it("returns mpg123 when mpv is not available", () => {
    const spawn = mockSpawn(["mpg123", "afplay"]);
    const result = detectPlayer(spawn);
    expect(result).not.toBeNull();
    expect(result!.binary).toBe("mpg123");
  });

  it("returns afplay when mpv and mpg123 are not available", () => {
    const spawn = mockSpawn(["afplay"]);
    const result = detectPlayer(spawn);
    expect(result).not.toBeNull();
    expect(result!.binary).toBe("afplay");
  });

  it("returns aplay when only aplay is available", () => {
    const spawn = mockSpawn(["aplay"]);
    const result = detectPlayer(spawn);
    expect(result).not.toBeNull();
    expect(result!.binary).toBe("aplay");
  });

  it("returns null when no player is available", () => {
    const spawn = mockSpawn([]);
    const result = detectPlayer(spawn);
    expect(result).toBeNull();
  });

  it("respects priority order (mpv over afplay even if both available)", () => {
    const spawn = mockSpawn(["afplay", "mpv"]);
    const result = detectPlayer(spawn);
    expect(result!.binary).toBe("mpv");
  });

  it("checks binaries in priority order", () => {
    const checked: string[] = [];
    const spawn = (args: string[]) => {
      checked.push(args[1]!);
      return { exitCode: 1 };
    };
    detectPlayer(spawn);
    expect(checked).toEqual(["mpv", "mpg123", "afplay", "aplay"]);
  });
});

describe("PlayerInfo volume flags", () => {
  it("mpv formats volume as percentage (0-100)", () => {
    const mpv = PLAYER_PRIORITY[0]!;
    expect(mpv.volumeFlag(0)).toEqual(["--volume=0"]);
    expect(mpv.volumeFlag(0.5)).toEqual(["--volume=50"]);
    expect(mpv.volumeFlag(1.0)).toEqual(["--volume=100"]);
  });

  it("mpg123 formats volume as scale (0-32768)", () => {
    const mpg123 = PLAYER_PRIORITY[1]!;
    expect(mpg123.volumeFlag(0)).toEqual(["--scale", "0"]);
    expect(mpg123.volumeFlag(0.5)).toEqual(["--scale", "16384"]);
    expect(mpg123.volumeFlag(1.0)).toEqual(["--scale", "32768"]);
  });

  it("afplay formats volume as float", () => {
    const afplay = PLAYER_PRIORITY[2]!;
    expect(afplay.volumeFlag(0.7)).toEqual(["-v", "0.7"]);
  });

  it("aplay returns no volume flags", () => {
    const aplay = PLAYER_PRIORITY[3]!;
    expect(aplay.volumeFlag(0.5)).toEqual([]);
  });
});
