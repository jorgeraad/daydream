# 20260212145510 - AudioManager & Game Integration

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:10 EST |
| **Last Modified**  | 2026-02-13 17:58:54 EST |
| **Status**         | completed |
| **Branch**         | main |
| **Agent**          | deep-aspen |
| **Blocked-By**     | 20260212145507, 20260212145508, 20260212145509 |
| **Feature**        | audio |
| **Touches**        | packages/audio/src/AudioManager.ts, packages/audio/src/index.ts, packages/audio/src/__tests__/AudioManager.test.ts, packages/engine/src/event/EventSystem.ts |
| **References**     | [Music & Sound Effects DD](../../docs/design-docs/20260212143111-music-sound-effects.md) |

## Description

Implement the `AudioManager` top-level orchestrator that ties together the chiptune engine, SFX manager, and audio players. Wire EventBus subscriptions so game events trigger audio responses (zone:entered → synthesize+play music, player:moved → footstep SFX, dialogue → blip/chime + music ducking, save → jingle, etc.). Add audio-related GameEvents to the engine EventSystem. Integrate into the game startup flow and implement temp file cleanup on destroy.

## Acceptance Criteria

- [x] `AudioManager` orchestrates music playback and SFX via EventBus subscriptions
- [x] zone:entered triggers music synthesis and playback (skips if same zone)
- [x] player:moved triggers footstep SFX
- [x] dialogue:started triggers blip SFX and ducks music volume
- [x] dialogue:ended triggers chime SFX and restores music volume
- [x] save:completed triggers save jingle SFX
- [x] Audio GameEvents added to engine EventSystem (audio:music-started, audio:music-stopped, audio:sfx-played)
- [x] AudioManager wired into game startup flow (after settings load, before gameplay)
- [x] Temp files cleaned up on `destroy()`
- [x] Unit tests for EventBus → audio trigger mapping
- [x] Unit tests for music ducking/restore behavior

## Implementation Steps

- [x] Add audio GameEvents to engine EventSystem (audio:music-started, audio:music-stopped, audio:sfx-played)
- [x] Create AudioManager class with constructor accepting EventBus, config, and zone lookup function
- [x] Wire EventBus subscriptions: zone:entered, player:moved, dialogue:started, dialogue:ended, save:completed
- [x] Implement onZoneEntered: skip if same zone, lookup musicSpec, synthesize WAV, write temp, play looped
- [x] Implement music ducking (reduce to ~30% during dialogue) and restore
- [x] Implement playSFX with enable/disable awareness
- [x] Emit audio GameEvents (audio:music-started, audio:music-stopped, audio:sfx-played)
- [x] Implement destroy() with temp file cleanup
- [x] Export AudioManager from packages/audio/src/index.ts
- [x] Wire AudioManager into GameShell startup flow
- [x] Write unit tests for EventBus -> audio trigger mapping (28 tests)
- [x] Write unit tests for music ducking/restore behavior

## Progress Log

### 2026-02-12 14:55:10 EST
Initial creation. Phase 5 of the Music & Sound Effects design doc. Convergence point — depends on synthesis, SFX, and AI music generation.

### 2026-02-13 17:47:59 EST
Starting work on branch `main`. Reviewed all dependency code: ChiptuneEngine, SFXManager, AudioPlayer, EventBus, GameShell, design doc. No file overlaps with in-progress tasks. Beginning implementation.

### 2026-02-13 17:58:54 EST
Implementation complete. All acceptance criteria met.

**Changes:**
- `packages/engine/src/event/EventSystem.ts`: Added 3 audio events to GameEvents interface: `audio:music-started`, `audio:music-stopped`, `audio:sfx-played`
- `packages/audio/src/AudioManager.ts`: Full orchestrator class (335 lines). Two AudioPlayer instances (music + SFX). EventBus subscriptions for zone:entered, player:moved, dialogue:started/ended, save:completed. Music ducking to 30% during dialogue. Configurable volumes. Temp file cleanup on destroy.
- `packages/audio/src/index.ts`: Exported AudioManager class and related types
- `packages/audio/src/__tests__/AudioManager.test.ts`: 28 tests covering event triggers, music ducking/restore, zone skip, enable/disable, temp cleanup, and state accessors

**Test results:** 193/193 audio tests pass, 122/122 game tests pass. No new typecheck errors in modified files.
