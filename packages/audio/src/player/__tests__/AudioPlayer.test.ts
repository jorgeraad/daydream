import { describe, expect, it } from "bun:test";
import {
  AudioPlayer,
  NullAudioPlayer,
  createAudioPlayer,
  type SpawnOptions,
  type SpawnResult,
} from "../AudioPlayer.ts";
import { PLAYER_PRIORITY, type PlayerInfo } from "../PlayerDetector.ts";

/** Create a mock SpawnResult that simulates a running process. */
function createMockProcess(options?: {
  onKill?: () => void;
}): SpawnResult & { _killed: boolean } {
  let exitCode: number | null = null;
  let resolveExited: ((code: number) => void) | undefined;
  const exited = new Promise<number>((resolve) => {
    resolveExited = resolve;
  });
  const proc = {
    _killed: false,
    kill() {
      this._killed = true;
      exitCode = 9;
      resolveExited?.(9);
      options?.onKill?.();
    },
    get exitCode() {
      return exitCode;
    },
    exited,
  };
  return proc;
}

/** Create a mock spawn function that records calls and returns mock processes. */
function createMockSpawn() {
  const calls: Array<{ args: string[]; options: SpawnOptions }> = [];
  const processes: Array<SpawnResult & { _killed: boolean }> = [];

  const spawnFn = (args: string[], options: SpawnOptions): SpawnResult => {
    const proc = createMockProcess();
    calls.push({ args, options });
    processes.push(proc);
    return proc;
  };

  return { spawnFn, calls, processes };
}

/** Get mpv PlayerInfo for testing (has native loop support). */
function getMpvPlayer(): PlayerInfo {
  return PLAYER_PRIORITY[0]!;
}

/** Get afplay PlayerInfo for testing (no native loop, requires re-spawn). */
function getAfplayPlayer(): PlayerInfo {
  return PLAYER_PRIORITY[2]!;
}

describe("AudioPlayer", () => {
  describe("play", () => {
    it("spawns the player binary with the file path", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/test.wav");

      expect(calls).toHaveLength(1);
      expect(calls[0]!.args[0]).toBe("mpv");
      expect(calls[0]!.args[calls[0]!.args.length - 1]).toBe("/tmp/test.wav");
    });

    it("includes volume flags when volume is specified", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/test.wav", { volume: 0.5 });

      expect(calls[0]!.args).toContain("--volume=50");
    });

    it("includes loop flags for players with native loop support", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/test.wav", { loop: true });

      expect(calls[0]!.args).toContain("--loop=inf");
    });

    it("stops previous playback before starting new playback", () => {
      const { spawnFn, processes } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/first.wav");
      const firstProcess = processes[0]!;

      player.play("/tmp/second.wav");

      expect(firstProcess._killed).toBe(true);
    });

    it("sets stdout and stderr to 'ignore'", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/test.wav");

      expect(calls[0]!.options.stdout).toBe("ignore");
      expect(calls[0]!.options.stderr).toBe("ignore");
    });
  });

  describe("stop", () => {
    it("kills the running process", () => {
      const { spawnFn, processes } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/test.wav");
      player.stop();

      expect(processes[0]!._killed).toBe(true);
    });

    it("clears the current file", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/test.wav");
      expect(player.getCurrentFile()).toBe("/tmp/test.wav");

      player.stop();
      expect(player.getCurrentFile()).toBeNull();
    });

    it("is safe to call when nothing is playing", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      expect(() => player.stop()).not.toThrow();
    });
  });

  describe("isPlaying", () => {
    it("returns true when a process is running", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/test.wav");

      expect(player.isPlaying()).toBe(true);
    });

    it("returns false when nothing has been played", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      expect(player.isPlaying()).toBe(false);
    });

    it("returns false after stop", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/test.wav");
      player.stop();

      expect(player.isPlaying()).toBe(false);
    });
  });

  describe("getCurrentFile", () => {
    it("returns the path of the currently playing file", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.play("/tmp/music.wav");

      expect(player.getCurrentFile()).toBe("/tmp/music.wav");
    });

    it("returns null when nothing is playing", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      expect(player.getCurrentFile()).toBeNull();
    });
  });

  describe("volume", () => {
    it("defaults to 1.0", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      expect(player.getVolume()).toBe(1.0);
    });

    it("can be set via setVolume", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.setVolume(0.5);
      expect(player.getVolume()).toBe(0.5);
    });

    it("clamps volume to 0-1 range", () => {
      const { spawnFn } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.setVolume(-0.5);
      expect(player.getVolume()).toBe(0);

      player.setVolume(1.5);
      expect(player.getVolume()).toBe(1);
    });

    it("uses default volume when play() has no explicit volume", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.setVolume(0.3);
      player.play("/tmp/test.wav");

      // mpv volume flag at 30%
      expect(calls[0]!.args).toContain("--volume=30");
    });

    it("explicit volume in play() overrides default", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getMpvPlayer(), spawnFn });

      player.setVolume(0.3);
      player.play("/tmp/test.wav", { volume: 0.8 });

      expect(calls[0]!.args).toContain("--volume=80");
    });
  });

  describe("looping with re-spawn (afplay/aplay)", () => {
    it("does not include loop flag for players without native support", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getAfplayPlayer(), spawnFn });

      player.play("/tmp/test.wav", { loop: true });

      // afplay has no native loop flag, so none should appear
      const argsStr = calls[0]!.args.join(" ");
      expect(argsStr).not.toContain("--loop");
    });

    it("sets up onExit callback for re-spawn looping", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getAfplayPlayer(), spawnFn });

      player.play("/tmp/test.wav", { loop: true });

      // The onExit callback should be set
      expect(calls[0]!.options.onExit).toBeDefined();
    });

    it("re-spawns when process exits and looping is active", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getAfplayPlayer(), spawnFn });

      player.play("/tmp/test.wav", { loop: true });
      expect(calls).toHaveLength(1);

      // Simulate the process exiting — trigger onExit
      calls[0]!.options.onExit!();

      expect(calls).toHaveLength(2);
      expect(calls[1]!.args[calls[1]!.args.length - 1]).toBe("/tmp/test.wav");
    });

    it("does not re-spawn after stop() is called", () => {
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: getAfplayPlayer(), spawnFn });

      player.play("/tmp/test.wav", { loop: true });
      player.stop();

      // Simulate the first process exiting after stop
      calls[0]!.options.onExit!();

      // Should not have spawned a second process
      expect(calls).toHaveLength(1);
    });
  });

  describe("different player types", () => {
    it("uses mpg123 with correct loop and volume flags", () => {
      const mpg123 = PLAYER_PRIORITY[1]!;
      const { spawnFn, calls } = createMockSpawn();
      const player = new AudioPlayer({ player: mpg123, spawnFn });

      player.play("/tmp/test.wav", { loop: true, volume: 0.5 });

      const args = calls[0]!.args;
      expect(args[0]).toBe("mpg123");
      expect(args).toContain("--scale");
      expect(args).toContain("16384");
      expect(args).toContain("--loop");
      expect(args).toContain("0");
    });
  });
});

describe("NullAudioPlayer", () => {
  it("play does nothing and does not throw", () => {
    const player = new NullAudioPlayer();
    expect(() => player.play("/tmp/test.wav")).not.toThrow();
    expect(() => player.play("/tmp/test.wav", { loop: true, volume: 0.5 })).not.toThrow();
  });

  it("stop does nothing", () => {
    const player = new NullAudioPlayer();
    expect(() => player.stop()).not.toThrow();
  });

  it("isPlaying always returns false", () => {
    const player = new NullAudioPlayer();
    expect(player.isPlaying()).toBe(false);
  });

  it("getCurrentFile always returns null", () => {
    const player = new NullAudioPlayer();
    expect(player.getCurrentFile()).toBeNull();
  });

  it("getVolume returns 0", () => {
    const player = new NullAudioPlayer();
    expect(player.getVolume()).toBe(0);
  });

  it("setVolume does nothing", () => {
    const player = new NullAudioPlayer();
    expect(() => player.setVolume(0.5)).not.toThrow();
    expect(player.getVolume()).toBe(0);
  });
});

describe("createAudioPlayer", () => {
  it("returns AudioPlayer when playerInfo is provided", () => {
    const player = createAudioPlayer(getMpvPlayer());
    expect(player).toBeInstanceOf(AudioPlayer);
  });

  it("returns NullAudioPlayer when playerInfo is null", () => {
    const player = createAudioPlayer(null);
    expect(player).toBeInstanceOf(NullAudioPlayer);
  });
});
