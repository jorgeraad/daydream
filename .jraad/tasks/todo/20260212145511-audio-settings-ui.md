# 20260212145511 - Audio Settings & UI

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:11 EST |
| **Last Modified**  | 2026-02-12 14:55:11 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212145510 |
| **Feature**        | audio |
| **Touches**        | apps/game/src/settings/, packages/audio/src/types.ts |
| **References**     | [Music & Sound Effects DD](../../docs/design-docs/20260212143111-music-sound-effects.md) |

## Description

Add audio settings to the existing settings system. Define the `AudioSettings` Zod schema (master enabled, music on/off, SFX on/off, master/music/SFX volume), extend `SettingsManager` to load/save the audio section in `~/.daydream/settings.json`, add audio controls to the `SettingsScreen` (toggles and volume bar), implement runtime keyboard toggles (`m` for music, `n` for SFX in exploration mode), and connect settings changes to the AudioManager.

## Acceptance Criteria

- [ ] `AudioSettings` Zod schema with sensible defaults (music on, SFX on, master 0.7, music 0.6, SFX 0.8)
- [ ] `SettingsManager` loads/saves audio section in settings.json
- [ ] Audio section in `SettingsScreen` with music/SFX toggles and volume display
- [ ] `m` key toggles music on/off in exploration mode
- [ ] `n` key toggles SFX on/off in exploration mode
- [ ] Settings changes propagated to AudioManager in real-time
- [ ] Unit tests for AudioSettings schema validation and defaults
- [ ] Unit tests for settings persistence round-trip

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:55:11 EST
Initial creation. Phase 6 of the Music & Sound Effects design doc. Final audio task — adds user-facing controls.
