# 20260212172319 - Build GameInput Component

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 17:23:19 EST |
| **Last Modified**  | 2026-02-12 17:34:59 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | keen-lynx |
| **Blocked-By**     | none |
| **Feature**        | text-input |
| **Touches**        | packages/renderer/src/ui/GameInput.ts, packages/renderer/src/index.ts, packages/renderer/src/__tests__/GameInput.test.ts |
| **References**     | [Reusable Text Input DD](../../docs/design-docs/20260212170437-reusable-text-input.md) |

## Description

Implement `GameInput` class in `@daydream/renderer` wrapping OpenTUI's `InputRenderable` + `BoxRenderable` with game-standard styling (Tokyo Night colors, rounded border), submit/cancel/change callbacks, and focus management. This is the foundation component all input screens will use.

## Acceptance Criteria

- [x] `GameInput` class wraps `InputRenderable` + `BoxRenderable` with composition
- [x] Standard game styling (colors, rounded border, placeholder support)
- [x] `onSubmit`, `onChange`, `onCancel` callbacks wired correctly
- [x] Escape key triggers `onCancel`
- [x] `value` getter/setter, `focus()`/`blur()`, `destroy()` work
- [x] Exported from `packages/renderer/src/index.ts`
- [x] Unit tests for value get/set, onSubmit on Enter, onCancel on Escape

## Implementation Steps

- [x] Create `GameInput` class with `InputRenderable` + `BoxRenderable` composition
- [x] Wire `onSubmit` via "enter" event (InputRenderable.submit() doesn't call super.submit())
- [x] Wire `onChange` via `onContentChange`
- [x] Wire `onCancel` via `onKeyDown` escape detection
- [x] Export from renderer index
- [x] Write 8 unit tests using `createTestRenderer` + `mockInput` with kitty keyboard mode
- [x] All tests pass

## Progress Log

### 2026-02-12 17:23:19 EST
Initial creation. Extracted from reusable text input design doc (Section 5 + Task 1 in Section 8).

### 2026-02-12 17:34:19 EST
Completed. Key findings: InputRenderable.submit() emits "enter" event but doesn't call super.submit() (where onSubmit lives), so must use `.on("enter", ...)` instead. onKeyDown fires BEFORE handleKeyPress in OpenTUI. Escape key testing requires kitty keyboard mode in createTestRenderer. All 8 tests pass.
