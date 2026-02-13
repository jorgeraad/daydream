# 20260212145511 - Audio Settings & UI

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:11 EST |
| **Last Modified**  | 2026-02-13 18:07:54 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | clear-hawk |
| **Blocked-By**     | 20260212145510 |
| **Feature**        | audio |
| **Touches**        | apps/game/src/settings/, packages/audio/src/types.ts |
| **References**     | [Music & Sound Effects DD](../../docs/design-docs/20260212143111-music-sound-effects.md) |

## Description

Add audio settings to the existing settings system. Define the `AudioSettings` Zod schema (master enabled, music on/off, SFX on/off, master/music/SFX volume), extend `SettingsManager` to load/save the audio section in `~/.daydream/settings.json`, add audio controls to the `SettingsScreen` (toggles and volume bar), implement runtime keyboard toggles (`m` for music, `n` for SFX in exploration mode), and connect settings changes to the AudioManager.

## Acceptance Criteria

- [x] `AudioSettings` Zod schema with sensible defaults (music on, SFX on, master 0.7, music 0.6, SFX 0.8)
- [x] `SettingsManager` loads/saves audio section in settings.json
- [x] Audio section in `SettingsScreen` with music/SFX toggles and volume display
- [x] `m` key toggles music on/off in exploration mode
- [x] `n` key toggles SFX on/off in exploration mode
- [x] Settings changes propagated to AudioManager in real-time
- [x] Unit tests for AudioSettings schema validation and defaults
- [x] Unit tests for settings persistence round-trip

## Implementation Steps

- [x] Define `AudioSettingsSchema` Zod schema in `apps/game/src/settings/AudioSettings.ts`
- [x] Add `getAudioSettings()` and `setAudioSettings()` methods to `SettingsManager`
- [x] Add Audio section to `SettingsScreen` (music/SFX toggles, volume display)
- [x] Add `m`/`n` keyboard toggles to `InputRouter` for music/SFX in exploration mode (move map from `m` to `M`)
- [x] Add `onAudioToggle` callback support to `InputRouter` for settings propagation
- [x] Wire audio toggles to `AudioManager` in `index.ts` gameplay setup
- [x] Write unit tests for `AudioSettings` schema validation and defaults
- [x] Write unit tests for settings persistence round-trip with audio section
- [x] Update `InputRouter` tests for new `m`/`n` keys

## Progress Log

### 2026-02-12 14:55:11 EST
Initial creation. Phase 6 of the Music & Sound Effects design doc. Final audio task — adds user-facing controls.

### 2026-02-13 18:00:28 EST
Starting work on branch `main`. Agent: clear-hawk. Note: `m` key in InputRouter is currently bound to map mode. Will rebind map to `M` (Shift+m) to free `m` for music toggle as specified in acceptance criteria. No Touches overlap with other in-progress tasks.

### 2026-02-13 18:06:04 EST
Completed all acceptance criteria. Implementation summary:

**New files:**
- `apps/game/src/settings/AudioSettings.ts` -- Zod schema with defaults (enabled=true, musicEnabled=true, sfxEnabled=true, masterVolume=0.7, musicVolume=0.6, sfxVolume=0.8)
- `apps/game/src/__tests__/AudioSettings.test.ts` -- 16 tests: schema validation, defaults, persistence round-trip, corrupt data handling, partial updates
- `apps/game/src/__tests__/AudioToggle.test.ts` -- 7 tests: m/n keys in exploration, no toggle in other modes, M for map, handler clearing

**Modified files:**
- `apps/game/src/settings/SettingsManager.ts` -- Added `getAudioSettings()` and `setAudioSettings()` methods with Zod validation
- `apps/game/src/settings/SettingsScreen.ts` -- Added Audio section with music/SFX toggles, master/music/SFX volume bars with left/right arrow adjustment, `onAudioChange` callback
- `apps/game/src/InputRouter.ts` -- `m` key now toggles music (was map), `n` key toggles SFX, map moved to `M` (Shift+m). Added `AudioToggleHandler` type and `setAudioToggleHandler()` method
- `apps/game/src/index.ts` -- AudioManager now initializes from saved audio settings; audio toggle handler wired to AudioManager + settings persistence; settingsManager passed through GameplayOptions
- `apps/game/package.json` -- Added `zod` dependency (catalog)

**Key decisions:**
- Map mode keybinding changed from `m` to `M` (Shift+m) to accommodate music toggle on `m` per acceptance criteria
- SettingsScreen uses `onAudioChange` callback pattern (consistent with existing `onLoggingChange`)
- Audio toggles persist to disk immediately (via `setAudioSettings`) so settings survive restarts

All 145 tests pass. No new TypeScript errors.
