# 20260212130954 - Settings & API Key Management

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 13:09:54 EST |
| **Last Modified**  | 2026-02-12 13:09:54 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212114214 |
| **Touches**        | apps/game/src/TitleScreen.ts, apps/game/src/settings/SettingsManager.ts, apps/game/src/settings/SettingsScreen.ts, apps/game/src/index.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Build a general settings system at `~/.daydream/` that supports API keys for multiple providers and future user preferences. Credentials are stored separately from settings with restrictive file permissions. The title screen links to a settings view where users can add/update API keys. On startup, the system loads saved credentials, falling back to environment variables (e.g., `ANTHROPIC_API_KEY`). Designed to be extensible for additional providers (OpenAI, Google, etc.) and preference categories.

## Acceptance Criteria

- [ ] `~/.daydream/` directory created on first run
- [ ] `~/.daydream/settings.json` stores general preferences (extensible schema)
- [ ] `~/.daydream/credentials.json` stores API keys keyed by provider (e.g., `{"anthropic": "sk-..."}`) with `0600` permissions
- [ ] Settings manager loads credentials on startup: saved file → env var fallback (e.g., `ANTHROPIC_API_KEY`)
- [ ] Title screen has a "Settings" option (e.g., press `s`) that opens the settings view
- [ ] Settings view shows configured providers with masked keys, allows add/update/remove
- [ ] Input is masked (shows `sk-ant...xxxx` not the full key)
- [ ] `AIClient` resolves API key via settings manager instead of reading env directly
- [ ] Provider-keyed design: easy to add `openai`, `google`, etc. later
- [ ] Unit tests for settings manager (read/write/fallback/permissions)

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 13:09:54 EST
Initial creation. User request during AI World Generation task (20260212114214). Need secure API key storage so users don't require env vars. Designed with multi-provider and general settings extensibility in mind.
