# 20260212165500 - Logging Startup Wiring

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 16:55:06 EST |
| **Last Modified**  | 2026-02-12 17:11:26 EST |
| **Status**         | completed |
| **Branch**         | main |
| **Agent**          | fast-hawk |
| **Blocked-By**     | 20260212165458, 20260212165459 |
| **Feature**        | logging |
| **Touches**        | apps/game/src/index.ts |
| **References**     | [Logging DD](../../docs/design-docs/20260212164737-logging-system.md) (Sections 5.6, 5.3) |

## Description

Wire configureLogging() into the game's main() function as the first initialization step. Read logging settings from SettingsManager, call configureLogging with them, and add game lifecycle log statements (startup, settings loaded, world generation start, gameplay start). Fix the silent world generation error handler to log the error and show a message to the player.

## Acceptance Criteria

- [x] `configureLogging()` is called before any other initialization in main()
- [x] Logging settings read from SettingsManager and passed to configureLogging
- [x] Game startup logged at info level
- [x] World generation failure logged at error level with prompt, error message, and stack trace
- [x] Loading screen shows "Generation failed — loading demo world..." on failure instead of silently falling back
- [x] Gameplay start logged with zone ID, spawn position, and character count
- [x] `bun run typecheck` passes

## Implementation Steps

- [x] Import configureLogging and getLogger in index.ts
- [x] Move SettingsManager.load() before renderer creation
- [x] Call configureLogging with settings values
- [x] Add lifecycle logging (startup, world gen, gameplay start)
- [x] Wire setOnLoggingChange callback in settings screen
- [x] Replace silent error handler with logging + user message

## Progress Log

### 2026-02-12 16:55:06 EST
Initial creation. Extracted from logging system design doc (Section 9, tasks 6+9).

### 2026-02-12 17:11:26 EST
Completed. Code was applied by steady-marten in previous session; verified and finalized by fast-hawk. configureLogging wired as first init step, settings read from SettingsManager, lifecycle logs added at info level, error handler logs at error level with context and shows user-facing message.
