# 20260212145507 - Chiptune Synthesis Engine

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:07 EST |
| **Last Modified**  | 2026-02-12 14:55:07 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212145506 |
| **Feature**        | audio |
| **Touches**        | packages/audio/src/synth/, packages/audio/src/types.ts |
| **References**     | [Music & Sound Effects DD](../../docs/design-docs/20260212143111-music-sound-effects.md) |

## Description

Implement the procedural chiptune synthesis engine that renders `MusicSpec` structures into WAV audio buffers. This includes the Zod schemas for music data (`MusicSpec`, `Channel`, `Note`), four oscillator waveform generators (square, triangle, sawtooth, noise), a sequencer that steps through note patterns at BPM, WAV PCM encoding, and the top-level `ChiptuneEngine` that ties it all together. Pure computation — no I/O, fully testable.

## Acceptance Criteria

- [ ] `MusicSpec`, `Channel`, `Note` Zod schemas defined in types.ts
- [ ] TypeScript types derived via `z.infer<>` (no duplicate type definitions)
- [ ] Square wave oscillator with variable duty cycle (12.5%, 25%, 50%, 75%)
- [ ] Triangle wave oscillator
- [ ] Sawtooth wave oscillator
- [ ] Noise oscillator via 15-bit LFSR
- [ ] WAV encoder produces valid 16-bit mono PCM at 44100 Hz
- [ ] `Sequencer` steps through channel patterns at specified BPM with proper wrapping
- [ ] `ChiptuneEngine.render(musicSpec)` produces a complete WAV `Uint8Array`
- [ ] Normalization prevents clipping when summing multiple channels
- [ ] Unit tests for oscillator waveform accuracy
- [ ] Unit tests for sequencer timing and pattern wrapping
- [ ] Unit tests for WAV encoding (valid header, correct sample count)
- [ ] Unit test for full synthesis pipeline (MusicSpec → WAV buffer)

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:55:07 EST
Initial creation. Phase 2 of the Music & Sound Effects design doc. Can run in parallel with Sound Effects (20260212145508) after scaffolding completes.
