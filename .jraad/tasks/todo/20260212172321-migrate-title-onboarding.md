# 20260212172321 - Migrate TitleScreen + OnboardingScreen to GameInput

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 17:23:21 EST |
| **Last Modified**  | 2026-02-12 17:23:21 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212172319, 20260212172320 |
| **Feature**        | text-input |
| **Touches**        | apps/game/src/TitleScreen.ts, apps/game/src/OnboardingScreen.ts |
| **References**     | [Reusable Text Input DD](../../docs/design-docs/20260212170437-reusable-text-input.md) |

## Description

Replace manual buffer management in TitleScreen and OnboardingScreen with `GameInput` and `MaskedInput` respectively. Remove all manual cursor rendering and key handling for text input. Change TitleScreen's `[s] Settings` shortcut to `[Esc] Settings` via `onCancel`.

## Acceptance Criteria

- [ ] TitleScreen uses `GameInput` with placeholder "Describe your world..."
- [ ] TitleScreen `[s] Settings` shortcut replaced with `[Esc] Settings` via `onCancel`
- [ ] OnboardingScreen uses `MaskedInput` for API key entry
- [ ] OnboardingScreen phase state machine (intro -> input -> saved) still works
- [ ] All manual buffer/cursor code removed from both screens
- [ ] End-to-end: title prompt entry and onboarding API key entry work correctly

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 17:23:21 EST
Initial creation. Extracted from reusable text input design doc (Section 7.1, 7.2 + Task 3 in Section 8).
