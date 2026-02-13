# Design Doc: Music & Sound Effects System

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:31:11 EST |
| **Last Modified**  | 2026-02-12 14:31:11 EST |
| **Status**         | draft |
| **Author**         | deep-finch |
| **Task**           | 20260212133127 |
| **References**     | [Design Doc](../design.md), [PRD](../prd.md) |

---

## 1. Overview

### Problem

Daydream generates worlds, characters, dialogue, and events from text prompts — but the experience is silent. The PRD identifies this as an open question (Q4: "Can we integrate system audio for ambient sound/music, or is this a silent experience?") and lists procedural ambient sound as a Phase 3 feature. Without audio, AI-generated worlds feel less immersive despite rich narrative content.

### Solution

An audio system that follows Daydream's AI-native pattern: Claude generates structured music specifications (tempo, key, channels, note patterns), and a procedural chiptune engine synthesizes authentic 8-bit audio from those specifications in real-time. Sound effects are generated procedurally via parameter-based synthesis.

### Scope

**In scope:**
- New `@daydream/audio` package
- CLI-based audio playback engine (platform-aware, zero native dependencies)
- `MusicSpec` schema: AI-generated structured music parameters
- `ChiptuneEngine`: procedural 8-bit synthesis (square, triangle, sawtooth, noise oscillators)
- Seamless looping by construction (mathematical loop points)
- Procedural sound effects (sfxr-style parameter synthesis)
- Audio settings: music on/off, SFX on/off, volume controls
- EventBus integration for triggering music/SFX from game events
- AI prompt and tool schema for music generation (haiku model)

**Out of scope (future work):**
- Streaming music from external AI audio generation APIs (Suno, Mubert, Lyria)
- MIDI file import/export
- Multi-zone crossfade transitions (simple cut-to-new-track for MVP)
- Spatial audio or stereo panning
- Custom user soundfonts or instrument packs
- Weather-specific audio (rain, wind sounds)

---

## 2. Architecture

### 2.1 New Package: `@daydream/audio`

Audio is a distinct output modality, parallel to visual rendering. A new package keeps responsibilities clean:

```
@daydream/game (apps/game)
├── @daydream/engine    (core types, EventBus, WorldState)
├── @daydream/ai        (Claude API client, prompts, tool schemas)
├── @daydream/renderer  (TileRenderer, ViewportManager, UI panels)
│   └── @daydream/engine
└── @daydream/audio     (ChiptuneEngine, AudioPlayer, SFX)   ← NEW
    └── @daydream/engine
```

**Why not inside `@daydream/renderer`?** The renderer owns visual output (OpenTUI, FrameBuffer, tiles). Audio is an independent concern — it listens to the same events but produces sound, not pixels. Keeping them separate means either can be disabled without affecting the other.

### 2.2 Module Structure

```
packages/audio/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Public API exports
│   ├── AudioManager.ts          # Top-level orchestrator
│   ├── player/
│   │   ├── AudioPlayer.ts       # Platform-aware playback (spawn CLI player)
│   │   └── PlayerDetector.ts    # Detect available CLI audio players
│   ├── synth/
│   │   ├── ChiptuneEngine.ts    # Renders MusicSpec → WAV PCM data
│   │   ├── oscillators.ts       # Square, triangle, sawtooth, noise generators
│   │   ├── sequencer.ts         # Steps through note patterns at BPM
│   │   └── wav.ts               # WAV file header/encoding
│   ├── sfx/
│   │   ├── SFXManager.ts        # Trigger and play sound effects
│   │   └── generators.ts        # Procedural SFX generation (jsfxr-style)
│   └── types.ts                 # MusicSpec, SFXEvent schemas (Zod)
└── test/
    ├── ChiptuneEngine.test.ts
    ├── AudioPlayer.test.ts
    └── oscillators.test.ts
```

### 2.3 Data Flow

```
Zone generation request
  ├── AI call: zone-generation (sonnet) → ZoneSpec        ← existing
  └── AI call: music-generation (haiku) → MusicSpec       ← new, parallel
         │
         ▼
  ChiptuneEngine.render(musicSpec) → WAV buffer (in-memory, ~50-100ms)
         │
         ▼
  Write temp file → AudioPlayer.play(file, { loop: true })
```

```
Game events → AudioManager (EventBus subscriber)
  ├── zone:entered    → synthesize + play zone music
  ├── player:moved    → play footstep SFX
  ├── dialogue:started → play blip SFX, duck music volume
  ├── dialogue:ended  → play chime SFX, restore music volume
  ├── save:completed  → play save jingle SFX
  └── event:triggered → play alert SFX
```

---

## 3. Audio Playback Engine

### 3.1 Approach: CLI Player Wrapper

There are no mature Bun-native audio playback libraries. The most reliable cross-platform approach is spawning a CLI audio player via `Bun.spawn()`. This has zero native dependencies and works immediately.

### 3.2 Player Detection & Priority

At startup, `PlayerDetector` checks which audio players are available in `$PATH`:

| Priority | Player | Loop Support | Formats | Platforms |
|----------|--------|-------------|---------|-----------|
| 1 | `mpv` | `--loop=inf` | All | macOS, Linux |
| 2 | `mpg123` | `--loop 0` | MP3 | macOS, Linux |
| 3 | `afplay` | re-spawn on exit | WAV, MP3, AAC | macOS only |
| 4 | `aplay` | re-spawn on exit | WAV | Linux only |

Detection runs once at startup. If no player is found, audio is silently disabled (the game plays fine without sound).

```typescript
// PlayerDetector.ts
interface PlayerInfo {
  binary: string;
  loopFlag: string[] | null;  // null = must re-spawn for looping
  volumeFlag: (v: number) => string[];  // volume 0-1 → CLI args
  formats: string[];
}

const PLAYER_PRIORITY: PlayerInfo[] = [
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
    volumeFlag: () => [],  // aplay has no volume flag
    formats: ["wav"],
  },
];

export async function detectPlayer(): Promise<PlayerInfo | null> {
  for (const candidate of PLAYER_PRIORITY) {
    const result = Bun.spawnSync(["which", candidate.binary]);
    if (result.exitCode === 0) {
      return candidate;
    }
  }
  return null;
}
```

### 3.3 AudioPlayer API

```typescript
// AudioPlayer.ts
export class AudioPlayer {
  private process: Subprocess | null = null;
  private player: PlayerInfo;
  private looping = false;

  constructor(player: PlayerInfo) { ... }

  /** Play an audio file. If loop=true, loops until stop() is called. */
  play(filePath: string, options?: { loop?: boolean; volume?: number }): void {
    this.stop(); // stop any current playback

    const args = [this.player.binary];
    if (options?.volume !== undefined) {
      args.push(...this.player.volumeFlag(options.volume));
    }
    if (options?.loop && this.player.loopFlag) {
      args.push(...this.player.loopFlag);
    }
    args.push(filePath);

    this.looping = options?.loop ?? false;

    if (this.looping && !this.player.loopFlag) {
      this.startReSpawnLoop(filePath, args);
    } else {
      this.process = Bun.spawn(args, { stdout: "ignore", stderr: "ignore" });
    }
  }

  /** Stop current playback. */
  stop(): void {
    this.looping = false;
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  /** Check if audio is currently playing. */
  isPlaying(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  /** For players without native loop: re-spawn on exit. */
  private startReSpawnLoop(filePath: string, args: string[]): void {
    const spawn = () => {
      this.process = Bun.spawn(args, {
        stdout: "ignore",
        stderr: "ignore",
        onExit: () => {
          if (this.looping) spawn();
        },
      });
    };
    spawn();
  }
}
```

### 3.4 Temp File Management

The chiptune engine generates WAV data in memory. Before playback, it writes to a temp file:

```typescript
const tempPath = `${os.tmpdir()}/daydream-music-${zoneId}.wav`;
await Bun.write(tempPath, wavBuffer);
player.play(tempPath, { loop: true });
```

Temp files are cleaned up when music changes or on game exit. The `AudioManager.destroy()` method handles cleanup.

---

## 4. Music Generation Pipeline

### 4.1 AI Integration: MusicSpec

Music generation follows the same pattern as zone generation: Claude outputs structured data, code renders it. Instead of generating audio, Claude outputs a `MusicSpec` — a description of *what* to play, not *how* it sounds.

**New AI task type:** `music-generation` → uses `haiku` (fast, cheap, structured output)

**When it runs:** During zone generation, as a parallel request alongside the zone spec. The `WorldGenerator` already orchestrates multiple AI calls; music generation is one more.

### 4.2 MusicSpec Schema

```typescript
// packages/audio/src/types.ts
import { z } from "zod";

export const NoteSchema = z.object({
  /** MIDI note number (0-127). 0 = rest. */
  pitch: z.number().min(0).max(127),
  /** Duration in steps (1 = sixteenth note at base resolution). */
  duration: z.number().min(1).max(16),
  /** Velocity/volume (0-15, matching 4-bit NES range). */
  velocity: z.number().min(0).max(15).default(12),
});
export type Note = z.infer<typeof NoteSchema>;

export const ChannelSchema = z.object({
  /** Waveform type — matches classic NES/GB channels. */
  waveform: z.enum(["square", "triangle", "sawtooth", "noise"]),
  /** Duty cycle for square wave (12.5%, 25%, 50%, 75%). Ignored for other waveforms. */
  duty: z.enum(["12.5", "25", "50", "75"]).default("50"),
  /** Volume (0-15). */
  volume: z.number().min(0).max(15).default(12),
  /** Note pattern. Loops when the longest channel finishes. */
  pattern: z.array(NoteSchema),
});
export type Channel = z.infer<typeof ChannelSchema>;

export const MusicSpecSchema = z.object({
  /** Tempo in BPM (60-200). */
  bpm: z.number().min(60).max(200),
  /** Musical key (e.g., "C", "Am", "F#m"). */
  key: z.string(),
  /** Time signature numerator (3 or 4 for MVP). */
  timeSignature: z.number().min(3).max(4).default(4),
  /** Channels (2-4, matching NES hardware). */
  channels: z.array(ChannelSchema).min(2).max(4),
  /** Loop length in measures. All channels loop at this boundary. */
  loopMeasures: z.number().min(2).max(16).default(4),
  /** Mood tag for reference (not used in synthesis, just metadata). */
  mood: z.string().optional(),
});
export type MusicSpec = z.infer<typeof MusicSpecSchema>;
```

### 4.3 AI Tool Definition

Added to the AI pipeline alongside existing zone tools:

```typescript
// packages/ai/src/tools/music-tools.ts
import { MusicSpecSchema } from "@daydream/audio";
import { createToolDef } from "./schema-utils.ts";

export const musicGenerationTool = createToolDef(
  "generate_music",
  `Generate an 8-bit chiptune music specification for a game zone.
   Output a loopable pattern using 2-4 channels (square, triangle, sawtooth, noise).
   Keep patterns short (2-8 measures) for tight loops.
   Match the mood to the zone's biome and atmosphere.`,
  MusicSpecSchema,
);
```

### 4.4 Prompt Design

The music generation prompt includes zone context so Claude can match the mood:

```
You are composing 8-bit chiptune music for a terminal game zone.

Zone: {zoneName}
Biome: {biomeType}
Mood: {worldSeed.setting.tone}
Time of Day: {timeOfDay}
Weather: {weather}

Compose a short, loopable 8-bit music pattern that evokes this environment.
Use 2-4 channels. Keep the loop tight (2-8 measures).
Prefer pentatonic or modal scales for a classic game feel.
Use the noise channel for rhythm if appropriate.

Guidelines:
- Square waves: melody and harmony (vary duty cycle for timbral contrast)
- Triangle wave: bass lines (lower register, smooth tone)
- Sawtooth: lead melodies or bright harmonies
- Noise: percussion patterns (hi-hats, snares via frequency)
- Use rests (pitch=0) for rhythmic interest
- Keep velocity variation subtle (10-15 range for most notes)
```

### 4.5 Zone Integration

The `Zone` type gains an optional `musicSpec` field:

```typescript
// Added to ZoneSchema in packages/engine/src/types.ts:
musicSpec: MusicSpecSchema.optional(),
```

Populated during zone generation and persisted with the zone in SQLite.

---

## 5. Chiptune Synthesis Engine

### 5.1 Overview

`ChiptuneEngine` takes a `MusicSpec` and produces a WAV audio buffer. It is pure computation — no I/O, no async, fully testable.

### 5.2 Oscillators

Four waveform generators, matching the NES 2A03 audio chip:

```typescript
// oscillators.ts

/** Square wave with variable duty cycle. NES pulse channels. */
export function square(phase: number, duty: number): number {
  return phase < duty ? 1 : -1;
}

/** Triangle wave. NES triangle channel — softer bass/melody. */
export function triangle(phase: number): number {
  return phase < 0.5
    ? 4 * phase - 1
    : 3 - 4 * phase;
}

/** Sawtooth wave. Not on NES but common in chiptune (GB/C64). */
export function sawtooth(phase: number): number {
  return 2 * phase - 1;
}

/** White noise via LFSR. NES noise channel — percussion/hi-hats. */
export function noise(state: { lfsr: number }): number {
  // 15-bit LFSR (NES-style)
  const bit = ((state.lfsr >> 0) ^ (state.lfsr >> 1)) & 1;
  state.lfsr = (state.lfsr >> 1) | (bit << 14);
  return (state.lfsr & 1) ? 1 : -1;
}
```

All oscillators output values in the range `[-1, 1]`. Sample rate: 44100 Hz (CD quality, universally supported).

### 5.3 Sequencer

The sequencer steps through channel patterns at the specified BPM:

```typescript
// sequencer.ts
export class Sequencer {
  private sampleRate = 44100;
  private samplesPerStep: number;

  constructor(bpm: number) {
    // 1 step = 1 sixteenth note
    // samplesPerStep = sampleRate * 60 / (bpm * 4)
    this.samplesPerStep = Math.round(this.sampleRate * 60 / (bpm * 4));
  }

  /** Render the full loop as a Float32Array of PCM samples. */
  render(channels: Channel[], loopMeasures: number, timeSignature: number): Float32Array {
    const totalSteps = loopMeasures * timeSignature * 4; // 4 sixteenths per beat
    const totalSamples = totalSteps * this.samplesPerStep;
    const output = new Float32Array(totalSamples);

    for (const channel of channels) {
      this.renderChannel(channel, output, totalSteps);
    }

    // Normalize to prevent clipping
    this.normalize(output, channels.length);

    return output;
  }

  private renderChannel(channel: Channel, output: Float32Array, totalSteps: number): void {
    // Walk through the pattern, wrapping as needed
    // For each sample: determine current note, compute oscillator output, add to buffer
  }

  private normalize(output: Float32Array, channelCount: number): void {
    // Divide by channel count to prevent clipping from summing
    const scale = 1 / channelCount;
    for (let i = 0; i < output.length; i++) {
      output[i] *= scale;
    }
  }
}
```

**Rendering flow:**
1. Calculate total samples: `loopMeasures * timeSignature * 4 * samplesPerStep`
2. For each channel, walk through its pattern (wrapping at pattern end)
3. For each sample position within a note, generate the oscillator output at that note's frequency
4. Sum all channels into the output buffer
5. Normalize (divide by channel count) to prevent clipping
6. Output as 16-bit PCM in a WAV container

### 5.4 WAV Encoding

```typescript
// wav.ts
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1; // mono
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const buffer = new Uint8Array(headerSize + dataSize);
  const view = new DataView(buffer.buffer);

  // RIFF header
  writeString(buffer, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(buffer, 8, "WAVE");

  // fmt chunk
  writeString(buffer, 12, "fmt ");
  view.setUint32(16, 16, true);           // chunk size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(buffer, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write samples as 16-bit signed integers
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(headerSize + i * 2, Math.round(clamped * 32767), true);
  }

  return buffer;
}
```

**Why WAV?** Universal format support across all CLI players. No encoding overhead. For short loops (2-8 measures at 120 BPM), file sizes are small:
- 4 measures at 120 BPM = 8 seconds = ~705 KB WAV (mono, 16-bit, 44.1kHz)

### 5.5 MIDI-to-Frequency Conversion

```typescript
function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}
// note 69 = A4 (440 Hz), note 60 = C4 (middle C)
```

---

## 6. Sound Effects System

### 6.1 Procedural SFX Generation

Sound effects are generated procedurally (not AI-generated) using parameter-based synthesis, similar to the classic `sfxr` tool. This keeps SFX instant and deterministic.

### 6.2 SFX Catalog

| Category | Event Trigger | Sound Character |
|----------|--------------|-----------------|
| **Movement** | `player:moved` | Soft footstep tick (short noise burst) |
| **Zone transition** | `zone:entered` | Rising arpeggio (ascending square wave) |
| **Dialogue open** | `dialogue:started` | Text blip (short square wave chirp) |
| **Dialogue close** | `dialogue:ended` | Confirmation chime (two-note triangle) |
| **Save** | `save:completed` | Save jingle (short ascending chord) |
| **Event** | `event:triggered` | Alert ping (triangle wave with decay) |
| **Menu select** | UI navigation | Click/select blip |

### 6.3 SFX Generation Parameters

Each sound effect is defined as a parameter set:

```typescript
export const SFXPresetSchema = z.object({
  waveform: z.enum(["square", "triangle", "sawtooth", "noise"]),
  frequency: z.number(),          // Start frequency in Hz
  frequencySlide: z.number(),     // Hz per second (positive = rising)
  duration: z.number(),           // Seconds
  volume: z.number(),             // 0-1
  volumeDecay: z.number(),        // Decay rate (0 = sustain, 1 = instant)
  duty: z.number().optional(),    // Square wave duty cycle
});
export type SFXPreset = z.infer<typeof SFXPresetSchema>;
```

### 6.4 SFXManager

```typescript
export class SFXManager {
  private presets = new Map<string, SFXPreset>();
  private cache = new Map<string, Uint8Array>(); // name → WAV buffer
  private player: AudioPlayer;

  /** Register a named sound effect preset. */
  register(name: string, preset: SFXPreset): void {
    this.presets.set(name, preset);
  }

  /** Play a registered sound effect by name. Non-blocking. */
  play(name: string): void {
    let wav = this.cache.get(name);
    if (!wav) {
      const preset = this.presets.get(name);
      if (!preset) return;
      wav = renderSFX(preset); // generates WAV buffer from parameters
      this.cache.set(name, wav);
    }
    // Write to temp file and play (or reuse existing temp file)
    this.playBuffer(name, wav);
  }
}
```

SFX are rendered to small WAV buffers on first use, then cached. They play via a separate `AudioPlayer` instance so they don't interrupt music.

---

## 7. Audio Settings

### 7.1 Settings Schema

Audio settings integrate into the existing `SettingsManager` (`apps/game/src/settings/SettingsManager.ts`). The `settings.json` file gains a typed `audio` section:

```typescript
export const AudioSettingsSchema = z.object({
  /** Master audio enabled/disabled. */
  enabled: z.boolean().default(true),
  /** Background music enabled. */
  musicEnabled: z.boolean().default(true),
  /** Sound effects enabled. */
  sfxEnabled: z.boolean().default(true),
  /** Master volume (0.0 - 1.0). */
  masterVolume: z.number().min(0).max(1).default(0.7),
  /** Music volume relative to master (0.0 - 1.0). */
  musicVolume: z.number().min(0).max(1).default(0.6),
  /** SFX volume relative to master (0.0 - 1.0). */
  sfxVolume: z.number().min(0).max(1).default(0.8),
});
export type AudioSettings = z.infer<typeof AudioSettingsSchema>;
```

### 7.2 Settings Persistence

Stored in `~/.daydream/settings.json` alongside existing settings:

```json
{
  "audio": {
    "enabled": true,
    "musicEnabled": true,
    "sfxEnabled": true,
    "masterVolume": 0.7,
    "musicVolume": 0.6,
    "sfxVolume": 0.8
  }
}
```

### 7.3 Settings UI

Add an "Audio" section to the existing `SettingsScreen`:

```
┌─ Settings ──────────────────────────────┐
│                                          │
│  API Keys                                │
│  ─────────                               │
│  Anthropic: sk-ant-...****               │
│                                          │
│  Audio                                   │
│  ─────                                   │
│  Music:     [ON]  OFF                    │
│  SFX:       [ON]  OFF                    │
│  Volume:    ████████░░ 70%               │
│                                          │
│  [s] Save  [Esc] Back                    │
└──────────────────────────────────────────┘
```

### 7.4 Runtime Toggles

Quick keyboard shortcuts during gameplay (no need to open settings):

| Key | Action |
|-----|--------|
| `m` | Toggle music on/off |
| `n` | Toggle SFX on/off |

These are bound only in `exploration` game mode to avoid conflicts with dialogue/menu input.

---

## 8. EventBus Integration

### 8.1 AudioManager as Event Listener

The `AudioManager` is the top-level orchestrator. It subscribes to game events and triggers the appropriate audio response:

```typescript
export class AudioManager {
  private musicPlayer: AudioPlayer;
  private sfxPlayer: AudioPlayer;
  private sfxManager: SFXManager;
  private chiptuneEngine: ChiptuneEngine;
  private settings: AudioSettings;
  private currentZoneId: string | null = null;

  constructor(eventBus: EventBus, settings: AudioSettings) {
    // Subscribe to game events
    eventBus.on("zone:entered", (data) => this.onZoneEntered(data));
    eventBus.on("player:moved", () => this.playSFX("footstep"));
    eventBus.on("dialogue:started", () => {
      this.playSFX("dialogue-open");
      this.duckMusic();
    });
    eventBus.on("dialogue:ended", () => {
      this.playSFX("dialogue-close");
      this.restoreMusic();
    });
    eventBus.on("save:completed", () => this.playSFX("save"));
    eventBus.on("event:triggered", () => this.playSFX("alert"));
  }

  /** Called when entering a new zone. Synthesizes and plays zone music. */
  private async onZoneEntered(data: { zoneId: string }): Promise<void> {
    if (data.zoneId === this.currentZoneId) return; // same zone, keep playing
    this.currentZoneId = data.zoneId;

    // Zone's MusicSpec is stored on the Zone object (populated during generation)
    // Look up the zone, get its musicSpec, synthesize, play
  }

  /** Lower music volume during dialogue. */
  private duckMusic(): void {
    if (!this.settings.musicEnabled) return;
    // Reduce to 30% of current volume
  }

  /** Restore music volume after dialogue. */
  private restoreMusic(): void {
    if (!this.settings.musicEnabled) return;
    // Restore to settings.musicVolume
  }

  playSFX(name: string): void {
    if (!this.settings.sfxEnabled || !this.settings.enabled) return;
    this.sfxManager.play(name);
  }

  setMusicEnabled(enabled: boolean): void { ... }
  setSFXEnabled(enabled: boolean): void { ... }
  setVolume(volume: number): void { ... }

  destroy(): void {
    this.musicPlayer.stop();
    this.sfxPlayer.stop();
    // Clean up temp files
  }
}
```

### 8.2 New GameEvents

Add audio-related events to the `GameEvents` interface in `packages/engine/src/event/EventSystem.ts`:

```typescript
// Added to GameEvents interface:
"audio:music-started": { zoneId: string; mood?: string };
"audio:music-stopped": Record<string, never>;
"audio:sfx-played": { name: string };
```

These are informational — other systems can react to audio state if needed.

---

## 9. Performance Budget

### 9.1 Synthesis Performance

Chiptune synthesis is pure arithmetic — no I/O, no allocations in the hot loop.

| Metric | Budget | Expected |
|--------|--------|----------|
| Synthesis time (4-measure loop) | <200ms | ~50-100ms |
| WAV file size (8s loop) | <1MB | ~705KB |
| Memory (WAV buffer + oscillator state) | <2MB | ~1MB |
| Temp file disk usage | <5MB total | ~1-2MB (1-2 zones cached) |

### 9.2 Playback Overhead

The CLI player runs as a separate process. Impact on the game:

| Metric | Budget |
|--------|--------|
| CPU (player process) | <2% (mpv/mpg123 are lightweight) |
| Memory (player process) | <10MB |
| Spawn latency | <50ms |

### 9.3 AI Generation Cost

Music generation uses `haiku` (fastest, cheapest model):

| Metric | Expected |
|--------|----------|
| Input tokens | ~300 (prompt + zone context) |
| Output tokens | ~200 (MusicSpec JSON) |
| Latency | <2s |
| Cost per generation | ~$0.0003 |

This runs in parallel with zone generation, so it adds no latency to the zone loading flow.

---

## 10. Implementation Plan

### Phase 1: Package Scaffolding & Audio Playback
**Touches:** `packages/audio/`, `package.json` (root), `tsconfig.json` (root)

- Create `@daydream/audio` package (package.json, tsconfig.json, src/index.ts)
- Add to root workspace config and tsconfig project references
- Implement `PlayerDetector` (detect mpv/mpg123/afplay/aplay)
- Implement `AudioPlayer` (spawn, stop, loop, volume)
- Unit tests for player detection logic (mocked `which` calls)

### Phase 2: Chiptune Synthesis
**Touches:** `packages/audio/src/synth/`, `packages/audio/src/types.ts`

- Define `MusicSpec`, `Channel`, `Note` Zod schemas in types.ts
- Implement oscillators (square, triangle, sawtooth, noise)
- Implement WAV encoder
- Implement `Sequencer` (step through patterns at BPM)
- Implement `ChiptuneEngine` (render MusicSpec → WAV Uint8Array)
- Unit tests: oscillator waveform accuracy, sequencer timing, full synthesis output validation

### Phase 3: Sound Effects
**Touches:** `packages/audio/src/sfx/`

- Define `SFXPreset` Zod schema
- Implement procedural SFX renderer (parameter → WAV)
- Define SFX presets for each game event (footstep, dialogue blip, save chime, etc.)
- Implement `SFXManager` with preset registration and WAV caching
- Unit tests for SFX generation

### Phase 4: AI Music Generation
**Touches:** `packages/ai/src/tools/`, `packages/ai/src/types.ts`, `packages/engine/src/types.ts`, `apps/game/src/WorldGenerator.ts`

- Add `music-generation` task type to AI types
- Create music generation tool schema (Zod-derived via `createToolDef`)
- Write music generation prompt template
- Add optional `musicSpec` field to `Zone` schema
- Integrate into `WorldGenerator` (parallel AI call during zone gen)
- Update persistence to save/load MusicSpec with zones

### Phase 5: AudioManager & Integration
**Touches:** `packages/audio/src/AudioManager.ts`, `apps/game/src/`, `packages/engine/src/event/EventSystem.ts`

- Implement `AudioManager` (top-level orchestrator)
- Wire EventBus subscriptions (zone:entered, player:moved, dialogue, save, etc.)
- Add audio GameEvents to engine EventSystem
- Wire into game startup flow (after settings load, before gameplay)
- Implement music ducking during dialogue
- Temp file cleanup on destroy

### Phase 6: Settings & UI
**Touches:** `apps/game/src/settings/`, `packages/audio/src/types.ts`

- Add `AudioSettings` Zod schema
- Extend `SettingsManager` to load/save audio section
- Add audio controls to `SettingsScreen` (music/SFX toggles, volume)
- Add runtime keyboard toggles (`m`/`n` in exploration mode)
- Connect settings changes to AudioManager

### Parallelization

```
Phase 1 ──→ Phase 2 ──→ Phase 4 ──→ Phase 5
              │
              └──→ Phase 3 ──────────┘
                                      └──→ Phase 6
```

Phases 2 and 3 can run in parallel after Phase 1. Phase 4 depends on Phase 2 (needs MusicSpec schema). Phase 5 depends on Phases 2, 3, and 4. Phase 6 depends on Phase 5.

---

## Appendix A: Alternative Approaches Considered

### A.1 AI Audio Generation APIs (Rejected for MVP)

Services like Mubert, Suno, and Google Lyria RealTime can generate actual audio from text prompts. Researched options:

| Service | API | Cost | Gen Time | Loop Support |
|---------|-----|------|----------|-------------|
| Suno | No official API | ~$0.04/song | 30-60s | Partial (prompt-based) |
| Udio | No official API | Varies | 30-60s | No |
| MusicGen (Meta) | Replicate | ~$0.09/run | 57-66s | No |
| Mubert | Official | $49/mo+ | 8-14s | Yes |
| Lyria RealTime | Gemini API | ~$0.06/30s | Real-time | Streaming |
| Stable Audio | Official | Credit-based | Unknown | No |

**Rejected because:**
- **Latency**: 8-60 seconds per generation (unacceptable for zone transitions)
- **Cost**: $49+/month for API access (Mubert), or per-generation fees
- **Dependency**: Requires internet, API availability, and account management
- **Looping**: Most cannot guarantee seamless loops
- **Authenticity**: AI-generated "8-bit style" approximates the aesthetic but uses high-fidelity synthesis, not authentic hardware-constrained waveforms

**Decision**: The procedural approach produces more authentic 8-bit sound at zero cost with zero latency.

### A.2 Future Enhancement: Lyria RealTime

Google's Lyria RealTime (Gemini API) is the most promising future option. It streams music in real-time via WebSocket with explicit chiptune genre support and raw PCM output. If it exits experimental status, it could enable reactive music that shifts based on game state. Worth revisiting post-MVP.

### A.3 Native Audio via Bun FFI (Rejected)

Calling macOS AudioToolbox or Linux ALSA directly via `bun:ffi` was considered. While `AudioServicesPlaySystemSound` could work for short SFX (<30s, WAV only), the full audio queue APIs require complex callback management and struct passing that `bun:ffi` handles poorly. The CLI player approach is simpler and equally effective.

### A.4 Tone.js / Web Audio API (Not Viable)

Tone.js is the gold standard for browser audio synthesis but requires the Web Audio API, which does not exist in Node.js or Bun. Not viable for a terminal application.

---

## Appendix B: Audio Player Compatibility

Research on CLI audio player availability and capabilities:

| Player | macOS (default) | macOS (Homebrew) | Linux (apt) | Loop Flag | Volume Flag |
|--------|----------------|------------------|-------------|-----------|-------------|
| `afplay` | Pre-installed | N/A | N/A | None (re-spawn) | `-v <float>` |
| `aplay` | N/A | N/A | Pre-installed (ALSA) | None (re-spawn) | None |
| `mpv` | No | `brew install mpv` | `apt install mpv` | `--loop=inf` | `--volume=<0-100>` |
| `mpg123` | No | `brew install mpg123` | `apt install mpg123` | `--loop 0` | `--scale <0-32768>` |

**Recommendation**: Document in README that installing `mpv` or `mpg123` is recommended for best audio experience (native looping). The game works with `afplay`/`aplay` (pre-installed) but looping has a tiny gap at the re-spawn point.
