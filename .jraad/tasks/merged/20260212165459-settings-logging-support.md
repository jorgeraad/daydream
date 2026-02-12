# 20260212165459 - SettingsManager Logging Support & UI

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 16:55:06 EST |
| **Last Modified**  | 2026-02-12 17:14:40 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | steady-marten |
| **Blocked-By**     | none |
| **Feature**        | logging |
| **Touches**        | apps/game/src/settings/SettingsManager.ts, apps/game/src/settings/SettingsScreen.ts |
| **References**     | [Logging DD](../../docs/design-docs/20260212164737-logging-system.md) (Sections 4, 6) |

## Description

Extend SettingsManager with generic get/set methods for nested settings keys (e.g., `logging.level`), and add a Logging section to the in-game SettingsScreen with level and format dropdowns. Changes take effect immediately by re-calling configureLogging.

## Acceptance Criteria

- [ ] `SettingsManager.get<T>(key)` reads dot-separated paths from settings.json
- [ ] `SettingsManager.set(key, value)` writes dot-separated paths and persists to disk
- [ ] Settings screen shows a "Logging" section with level selection (trace/debug/info/warning/error/fatal) and format selection (text/json)
- [ ] Log file path displayed in settings screen as informational text
- [ ] `bun run typecheck` passes

## Implementation Steps

- [ ] Add generic `get<T>(key)` and `set(key, value)` to SettingsManager
- [ ] Add `writeSettings()` private method
- [ ] Add logging section to SettingsScreen with level/format options
- [ ] Run `bun run typecheck`

## Progress Log

### 2026-02-12 16:55:06 EST
Initial creation. Extracted from logging system design doc (Section 9, tasks 4-5).

### 2026-02-12 17:00:49 EST
Starting implementation on branch `main`. Existing SettingsManager at `apps/game/src/settings/SettingsManager.ts` handles credentials; adding generic settings access.

### 2026-02-12 17:14:40 EST
Branch merged to main.
