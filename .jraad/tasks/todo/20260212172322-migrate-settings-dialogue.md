# 20260212172322 - Migrate SettingsScreen + DialoguePanel to Reusable Input

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 17:23:22 EST |
| **Last Modified**  | 2026-02-12 17:23:22 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212172321 |
| **Feature**        | text-input |
| **Touches**        | apps/game/src/settings/SettingsScreen.ts, packages/renderer/src/ui/DialoguePanel.ts |
| **References**     | [Reusable Text Input DD](../../docs/design-docs/20260212170437-reusable-text-input.md) |

## Description

Replace manual edit buffer in SettingsScreen with `MaskedInput` overlay for API key editing, and replace DialoguePanel freeform mode with bare `InputRenderable`. Remove all manual buffer management from both files.

## Acceptance Criteria

- [ ] SettingsScreen edit mode uses `MaskedInput` overlay for the selected provider
- [ ] SettingsScreen navigation mode (arrow keys, cycling) unchanged
- [ ] DialoguePanel freeform mode uses bare `InputRenderable` (no GameInput wrapper)
- [ ] All manual buffer management removed from both files
- [ ] Settings key editing and dialogue freeform input work end-to-end

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 17:23:22 EST
Initial creation. Extracted from reusable text input design doc (Section 7.3, 7.4 + Task 4 in Section 8).
