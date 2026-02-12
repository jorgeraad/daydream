# 20260212172320 - Build MaskedInput Component

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 17:23:20 EST |
| **Last Modified**  | 2026-02-12 17:23:20 EST |
| **Status**         | todo |
| **Branch**         | — |
| **Agent**          | — |
| **Blocked-By**     | 20260212172319 |
| **Feature**        | text-input |
| **Touches**        | packages/renderer/src/ui/MaskedInput.ts, packages/renderer/src/index.ts |
| **References**     | [Reusable Text Input DD](../../docs/design-docs/20260212170437-reusable-text-input.md) |

## Description

Implement `MaskedInput` extending `GameInput` with shadow buffer masking for API key inputs. Real text is tracked in a parallel string while the display shows asterisks. Supports paste, undo/redo, and word deletion while maintaining sync between real and masked values.

## Acceptance Criteria

- [ ] `MaskedInput` extends `GameInput` with shadow buffer approach
- [ ] `value` getter returns real text, display shows mask characters
- [ ] Paste works correctly (real text captured, display shows asterisks)
- [ ] Undo/redo maintains sync between shadow buffer and display
- [ ] Word deletion works with masking
- [ ] Exported from `packages/renderer/src/index.ts`
- [ ] Unit tests: value returns real text, paste syncs correctly

## Implementation Steps

_To be filled in when the task is started._

## Progress Log

### 2026-02-12 17:23:20 EST
Initial creation. Extracted from reusable text input design doc (Section 6 + Task 2 in Section 8).
