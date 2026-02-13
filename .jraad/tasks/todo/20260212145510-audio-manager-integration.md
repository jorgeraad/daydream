# 20260212145510 - AudioManager & Game Integration

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:10 EST |
| **Last Modified**  | 2026-02-12 14:55:10 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212145507, 20260212145508, 20260212145509 |
| **Feature**        | audio |
| **Touches**        | packages/audio/src/AudioManager.ts, packages/audio/src/index.ts, apps/game/src/, packages/engine/src/event/EventSystem.ts |
| **References**     | [Music & Sound Effects DD](../../docs/design-docs/20260212143111-music-sound-effects.md) |

## Description

Implement the `AudioManager` top-level orchestrator that ties together the chiptune engine, SFX manager, and audio players. Wire EventBus subscriptions so game events trigger audio responses (zone:entered → synthesize+play music, player:moved → footstep SFX, dialogue → blip/chime + music ducking, save → jingle, etc.). Add audio-related GameEvents to the engine EventSystem. Integrate into the game startup flow and implement temp file cleanup on destroy.

## Acceptance Criteria

- [ ] `AudioManager` orchestrates music playback and SFX via EventBus subscriptions
- [ ] zone:entered triggers music synthesis and playback (skips if same zone)
- [ ] player:moved triggers footstep SFX
- [ ] dialogue:started triggers blip SFX and ducks music volume
- [ ] dialogue:ended triggers chime SFX and restores music volume
- [ ] save:completed triggers save jingle SFX
- [ ] Audio GameEvents added to engine EventSystem (audio:music-started, audio:music-stopped, audio:sfx-played)
- [ ] AudioManager wired into game startup flow (after settings load, before gameplay)
- [ ] Temp files cleaned up on `destroy()`
- [ ] Unit tests for EventBus → audio trigger mapping
- [ ] Unit tests for music ducking/restore behavior

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:55:10 EST
Initial creation. Phase 5 of the Music & Sound Effects design doc. Convergence point — depends on synthesis, SFX, and AI music generation.
