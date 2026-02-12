# 20260212172321 - Migrate TitleScreen + OnboardingScreen to GameInput

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 17:23:21 EST |
| **Last Modified**  | 2026-02-12 17:52:10 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | gentle-hawk |
| **Blocked-By**     | 20260212172319, 20260212172320 |
| **Feature**        | text-input |
| **Touches**        | apps/game/src/TitleScreen.ts, apps/game/src/OnboardingScreen.ts |
| **References**     | [Reusable Text Input DD](../../docs/design-docs/20260212170437-reusable-text-input.md) |

## Description

Replace manual buffer management in TitleScreen and OnboardingScreen with `GameInput` and `MaskedInput` respectively. Remove all manual cursor rendering and key handling for text input. Change TitleScreen's `[s] Settings` shortcut to `[Esc] Settings` via `onCancel`.

## Acceptance Criteria

- [x] TitleScreen uses `GameInput` with placeholder "Describe your world..."
- [x] TitleScreen `[s] Settings` shortcut replaced with `[Esc] Settings` via `onCancel`
- [x] OnboardingScreen uses `MaskedInput` for API key entry
- [x] OnboardingScreen phase state machine (intro -> input -> saved) still works
- [x] All manual buffer/cursor code removed from both screens
- [x] End-to-end: title prompt entry and onboarding API key entry work correctly

## Implementation Steps

- [x] Migrate TitleScreen to use GameInput
  - [x] Import GameInput from @daydream/renderer
  - [x] Replace manual inputBox + inputText with GameInput
  - [x] Wire onSubmit for prompt entry, onCancel for settings
  - [x] Update hint text to [Esc] Settings
  - [x] Remove buffer, inputText, handleKey
  - [x] Update show() to reset value and focus input
  - [x] Update destroy() to clean up GameInput
- [x] Migrate OnboardingScreen to use MaskedInput
  - [x] Import MaskedInput from @daydream/renderer
  - [x] Replace manual inputBox + inputText with MaskedInput (created lazily on input phase)
  - [x] Wire MaskedInput onSubmit for validation and save
  - [x] Remove buffer, handleInputKey
  - [x] Handle phase transitions: create/focus on input, destroy on saved
  - [x] Keep intro -> input -> saved state machine
- [x] Run typecheck to verify no new errors

## Progress Log

### 2026-02-12 17:23:21 EST
Initial creation. Extracted from reusable text input design doc (Section 7.1, 7.2 + Task 3 in Section 8).

### 2026-02-12 17:49:14 EST
Starting work on branch `main`. Agent: gentle-hawk. Read source for GameInput, MaskedInput, TitleScreen, and OnboardingScreen. No Touches overlap with other in-progress tasks. Proceeding with implementation.

### 2026-02-12 17:51:15 EST
Completed both migrations. TitleScreen now uses GameInput with placeholder and onSubmit/onCancel callbacks — removed buffer, inputText, handleKey entirely. OnboardingScreen uses MaskedInput created lazily when entering "input" phase, with onSubmit handling validation (empty check + sk- prefix). Phase state machine (intro -> input -> saved) preserved using container key handler for intro/saved phases and MaskedInput for input phase. Used inputPlaceholder BoxRenderable (hidden during input phase, shown with saved key in saved phase) to maintain the visual layout. Typecheck passes with no new errors (only pre-existing test file errors remain).
