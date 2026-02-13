# 20260212145508 - Sound Effects System

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:08 EST |
| **Last Modified**  | 2026-02-12 14:55:08 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212145506 |
| **Feature**        | audio |
| **Touches**        | packages/audio/src/sfx/ |
| **References**     | [Music & Sound Effects DD](../../docs/design-docs/20260212143111-music-sound-effects.md) |

## Description

Implement the procedural sound effects system using parameter-based synthesis (sfxr-style). Define the `SFXPreset` Zod schema, build a procedural SFX renderer that generates WAV buffers from parameter sets, create the preset catalog for all game events (footstep, zone transition, dialogue blip/chime, save jingle, alert, menu select), and implement `SFXManager` with preset registration and WAV caching.

## Acceptance Criteria

- [ ] `SFXPreset` Zod schema defined (waveform, frequency, frequencySlide, duration, volume, volumeDecay, duty)
- [ ] Procedural SFX renderer generates WAV buffers from `SFXPreset` parameters
- [ ] SFX presets defined for: footstep, zone transition, dialogue open, dialogue close, save, alert, menu select
- [ ] `SFXManager` supports preset registration, WAV caching, and non-blocking playback
- [ ] SFX play via a separate `AudioPlayer` instance (doesn't interrupt music)
- [ ] Unit tests for SFX generation (valid WAV output for each preset)
- [ ] Unit tests for SFXManager caching behavior

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:55:08 EST
Initial creation. Phase 3 of the Music & Sound Effects design doc. Can run in parallel with Chiptune Synthesis (20260212145507) after scaffolding completes.
