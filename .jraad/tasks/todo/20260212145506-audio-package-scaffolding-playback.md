# 20260212145506 - Audio Package Scaffolding & Playback

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:55:06 EST |
| **Last Modified**  | 2026-02-12 14:55:06 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212133127 |
| **Feature**        | audio |
| **Touches**        | packages/audio/, package.json, tsconfig.json |
| **References**     | [Music & Sound Effects DD](../../docs/design-docs/20260212143111-music-sound-effects.md) |

## Description

Create the `@daydream/audio` package and implement the platform-aware audio playback layer. This is the foundation for all audio functionality — the package scaffold, CLI player detection, and the `AudioPlayer` class that wraps `Bun.spawn()` to play WAV files via system CLI players (mpv, mpg123, afplay, aplay).

## Acceptance Criteria

- [ ] `@daydream/audio` package created with package.json, tsconfig.json, src/index.ts
- [ ] Package added to root workspace config and tsconfig project references
- [ ] `PlayerDetector` detects available CLI audio players in priority order (mpv > mpg123 > afplay > aplay)
- [ ] `AudioPlayer` supports play, stop, loop (native flag or re-spawn), and volume control
- [ ] Audio silently disabled when no player is found (game works without sound)
- [ ] Unit tests for player detection logic (mocked `which` calls)
- [ ] Unit tests for AudioPlayer play/stop/loop behavior

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 14:55:06 EST
Initial creation. Phase 1 of the Music & Sound Effects design doc. Foundation for all audio tasks.
