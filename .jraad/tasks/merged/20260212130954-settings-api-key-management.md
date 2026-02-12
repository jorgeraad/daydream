# 20260212130954 - Settings & API Key Management

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 13:09:54 EST |
| **Last Modified**  | 2026-02-12 13:40:39 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | calm-jackal |
| **Blocked-By**     | 20260212114214 |
| **Feature**        | settings |
| **Touches**        | apps/game/src/TitleScreen.ts, apps/game/src/settings/SettingsManager.ts, apps/game/src/settings/SettingsScreen.ts, apps/game/src/OnboardingScreen.ts, apps/game/src/index.ts |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Build a general settings system at `~/.daydream/` that supports API keys for multiple providers and future user preferences. Credentials are stored separately from settings with restrictive file permissions. The title screen links to a settings view where users can add/update API keys. On startup, the system loads saved credentials, falling back to environment variables (e.g., `ANTHROPIC_API_KEY`). Designed to be extensible for additional providers (OpenAI, Google, etc.) and preference categories.

## Acceptance Criteria

- [x] `~/.daydream/` directory created on first run
- [x] `~/.daydream/settings.json` stores general preferences (extensible schema)
- [x] `~/.daydream/credentials.json` stores API keys keyed by provider (e.g., `{"anthropic": "sk-..."}`) with `0600` permissions
- [x] Settings manager loads credentials on startup: saved file → env var fallback (e.g., `ANTHROPIC_API_KEY`)
- [x] Title screen has a "Settings" option (e.g., press `s`) that opens the settings view
- [x] Settings view shows configured providers with masked keys, allows add/update/remove
- [x] Input is masked (shows `sk-ant...xxxx` not the full key)
- [x] `AIClient` resolves API key via settings manager instead of reading env directly
- [x] Provider-keyed design: easy to add `openai`, `google`, etc. later
- [x] First-run onboarding flow gates access to title screen until API key is configured
- [x] Unit tests for settings manager (read/write/fallback/permissions)

## Implementation Steps

- [x] Create `apps/game/src/settings/SettingsManager.ts` — load/save credentials and settings, env var fallback, directory init
- [x] Create `apps/game/src/settings/SettingsScreen.ts` — TUI component for viewing/editing API keys
- [x] Create `apps/game/src/OnboardingScreen.ts` — first-run onboarding flow (welcome → API key input → confirmation)
- [x] Update `apps/game/src/TitleScreen.ts` — add "Settings" option (press `s`)
- [x] Update `apps/game/src/index.ts` — onboarding gate, settings loop, always use AI generation
- [x] Write unit tests for SettingsManager
- [x] Verify integration end-to-end

## Progress Log

### 2026-02-12 13:09:54 EST
Initial creation. User request during AI World Generation task (20260212114214). Need secure API key storage so users don't require env vars. Designed with multi-provider and general settings extensibility in mind.

### 2026-02-12 13:28:33 EST
Starting implementation on branch `main`. Blocker 20260212114214 (AI World Generation) is merged. Key context: AIClient already accepts `apiKey` in constructor options (packages/ai/src/client.ts), so no AI package changes needed. TitleScreen.ts and index.ts are the integration points — index.ts currently checks `process.env.ANTHROPIC_API_KEY` directly. Will create SettingsManager to abstract this, SettingsScreen for TUI management.

### 2026-02-12 13:34:36 EST
Implementation complete. All 10 acceptance criteria met, all 12 unit tests passing. Created SettingsManager (credentials + settings with 0600 perms, env var fallback, provider registry), SettingsScreen (TUI with keyboard nav, masked input, add/update/delete), updated TitleScreen (returns discriminated union, `[s]` opens settings when buffer empty), updated index.ts (settings loop before gameplay, passes API key to AIClient). No new typecheck errors introduced (pre-existing InputRouter.test.ts errors only).

### 2026-02-12 13:39:16 EST
Added OnboardingScreen — first-run UX gate. Users without an API key see a 3-phase onboarding (intro → masked key input with `sk-` validation → saved confirmation) before reaching the title screen. index.ts now always generates via AI (test zone only as fallback on generation failure). If user deletes their key in Settings, onboarding re-triggers.

### 2026-02-12 13:40:39 EST
Branch merged to the main branch.
