# Reusable Text Input Component — Design Document

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 17:04:37 EST |
| **Last Modified**  | 2026-02-12 17:08:23 EST |
| **Status**         | review |
| **Author**         | (pending) |
| **References**     | [Design Doc](../design.md), [PRD](../prd.md) |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Background & Current State](#3-background--current-state)
4. [Architecture](#4-architecture)
5. [GameInput Component](#5-gameinput-component)
6. [MaskedInput Component](#6-maskedinput-component)
7. [Screen Migrations](#7-screen-migrations)
8. [Implementation Plan](#8-implementation-plan)
9. [Appendices](#9-appendices)

---

## 1. Overview

### Problem

Every text input in Daydream (world prompt, API key entry, settings editing, dialogue freeform) manually implements its own buffer management — a `string` variable, character-by-character append, single-character backspace. None of them support paste, word navigation (Option+Left/Right), undo/redo, text selection, or any of the standard editing behaviors users expect from CLI tools.

The code is duplicated across 4 screens (~160 lines of identical logic), and each copy has the same limitations.

### Solution

Replace all manual input handling with a thin wrapper around OpenTUI's built-in `InputRenderable`, which provides all standard editing features out of the box. Create two reusable components:

1. **`GameInput`** — a styled single-line input with game-standard colors, border, and submit handling
2. **`MaskedInput`** — extends `GameInput` to display masked text (asterisks) for sensitive values like API keys

Migrate all 4 input screens to use these components, eliminating duplicated buffer logic and gaining full CLI editing support.

### What Users Get

After this change, every text input in Daydream supports:
- **Paste** (Cmd+V / Ctrl+V, bracketed paste)
- **Word navigation** (Option+Left/Right to jump words)
- **Undo/Redo** (Cmd+Z / Ctrl+Z, Cmd+Shift+Z)
- **Text selection** (Shift+arrows, Cmd+A)
- **Line navigation** (Home/End, Cmd+Left/Right)
- **Word deletion** (Option+Backspace, Option+Delete)
- **Placeholder text** when the input is empty

---

## 2. Goals & Non-Goals

### Goals

- Every text input supports standard CLI editing (paste, word nav, undo, selection)
- Single reusable component for all input screens
- API key inputs display masked (asterisks) while supporting full editing
- Consistent visual styling across all input screens
- Less code than the current implementation (net reduction)

### Non-Goals

- **Multi-line editing** — only the dialogue freeform needs this, and it's a small enough use case to handle separately with `TextareaRenderable` directly
- **Custom keybindings** — OpenTUI's defaults match standard macOS/Linux terminal conventions; no customization needed for MVP
- **Input validation framework** — validation logic stays in the screens (it's screen-specific, not input-specific)
- **Animated cursor** — OpenTUI handles cursor rendering internally

---

## 3. Background & Current State

### What Exists Today

Four screens implement manual text input:

| Screen | File | Input Type | Masking | Lines of Input Logic |
|--------|------|-----------|---------|---------------------|
| TitleScreen | `apps/game/src/TitleScreen.ts` | World prompt | No | ~25 |
| OnboardingScreen | `apps/game/src/OnboardingScreen.ts` | API key | Yes (`*`) | ~30 |
| SettingsScreen | `apps/game/src/settings/SettingsScreen.ts` | API key edit | Yes (`*`) | ~35 |
| DialoguePanel | `packages/renderer/src/ui/DialoguePanel.ts` | Freeform text | No | ~30 |

**Total: ~120 lines** of near-identical input handling, all with these limitations:
- No paste support
- No word navigation (Option+Left/Right)
- No undo/redo
- No text selection
- No Home/End
- No word deletion (Option+Backspace)
- Manual cursor rendering (`█` appended to buffer)

### What OpenTUI Provides

`InputRenderable` (single-line) and `TextareaRenderable` (multi-line) are built-in components that provide:

- Full cursor management (blinking cursor, positioned correctly)
- Paste via `onPaste` handler and `PasteEvent`
- Word navigation via Option+Left/Right (default keybindings)
- Undo/redo via Ctrl+Z / Ctrl+Shift+Z
- Text selection via Shift+arrows, Ctrl+A
- Line nav via Home/End, Ctrl+A/E
- Word deletion via Option+Backspace, Option+Delete
- Placeholder text with styling
- Focus/blur color transitions
- `onSubmit` callback on Enter
- `value` property for get/set

These are fully tested, handle edge cases (grapheme clusters, wide chars), and integrate with OpenTUI's rendering pipeline.

---

## 4. Architecture

### Component Hierarchy

```
@daydream/renderer
└── ui/
    ├── GameInput.ts        — Styled InputRenderable wrapper
    └── MaskedInput.ts      — GameInput with masked display
```

### Where It Lives

Both components live in `@daydream/renderer` alongside other UI components (NarrativeBar, DialoguePanel, LoadingScreen, etc.). They're exported from the renderer package index.

### Relationship to OpenTUI

```
GameInput (our wrapper)
  └── InputRenderable (OpenTUI built-in)
      └── TextareaRenderable
          └── EditBufferRenderable
              └── Renderable
```

`GameInput` does **not** subclass `InputRenderable`. It composes it — creating an `InputRenderable` internally and exposing a focused API surface. This keeps us decoupled from OpenTUI's class hierarchy while using its functionality.

---

## 5. GameInput Component

### Interface

```typescript
// packages/renderer/src/ui/GameInput.ts

export interface GameInputConfig {
  /** Unique element ID */
  id: string
  /** Width of the input box (including border). Default: 60 */
  width?: number
  /** Placeholder text shown when empty */
  placeholder?: string
  /** Maximum character length. Default: unlimited */
  maxLength?: number
  /** Initial value */
  value?: string
  /** Called when user presses Enter */
  onSubmit?: (value: string) => void
  /** Called on every keystroke/edit */
  onChange?: (value: string) => void
  /** Called when user presses Escape */
  onCancel?: () => void
}

export class GameInput {
  /** The outer BoxRenderable (border + padding). Add this to your layout. */
  readonly container: BoxRenderable

  /** Get the current text value */
  get value(): string

  /** Set the text value programmatically */
  set value(text: string)

  /** Focus the input (activates cursor and key handling) */
  focus(): void

  /** Blur the input */
  blur(): void

  /** Whether the input is currently focused */
  get focused(): boolean

  /** Clean up resources */
  destroy(): void
}
```

### Construction

```typescript
constructor(renderer: CliRenderer, config: GameInputConfig) {
  // Create bordered container
  this.container = new BoxRenderable(renderer, {
    id: config.id,
    width: config.width ?? 60,
    height: 3,
    border: true,
    borderStyle: "rounded",
    borderColor: COLORS.border,
    paddingX: 1,
    justifyContent: "center",
  })

  // Create the actual input inside the border
  this.input = new InputRenderable(renderer, {
    value: config.value ?? "",
    placeholder: config.placeholder,
    maxLength: config.maxLength,
    backgroundColor: COLORS.inputBg,
    textColor: COLORS.text,
    focusedBackgroundColor: COLORS.inputBg,
    focusedTextColor: COLORS.text,
    placeholderColor: COLORS.placeholder,
    onSubmit: () => config.onSubmit?.(this.input.value),
  })

  this.container.add(this.input)

  // Wire Escape key
  this.input.handleKeyPress = (key) => {
    if (key.name === "escape") {
      config.onCancel?.()
      return true // consumed
    }
    return false // let InputRenderable handle normally
  }
}
```

### Styling Constants

```typescript
const COLORS = {
  border: "#7aa2f7",
  borderFocused: "#7aa2f7",
  inputBg: "#0a0a1a",
  text: "#c0caf5",
  placeholder: "#414868",
}
```

These match the existing visual style across all screens.

### Focus Management

When `focus()` is called on `GameInput`, it delegates to `InputRenderable.focus()`. The `InputRenderable` handles:
- Registering its `keypressHandler` on the renderer's key handler
- Showing the cursor
- Applying focused colors
- Handling all key events (typing, paste, word nav, undo, etc.)

The parent screen no longer needs a `container.onKeyDown` handler for text input. It only needs to handle screen-level keys (like 's' for settings on the title screen) via a separate mechanism.

### Screen-Level Key Handling

Some screens need to handle keys that aren't part of text editing (e.g., TitleScreen's 's' for settings when the buffer is empty). There are two approaches:

**Option A: Check value in onSubmit/onChange** — the screen reads `gameInput.value` and decides what to do. For example, TitleScreen checks if the value starts with 's' and the input was just activated.

**Option B: Escape-based navigation** — screen-level actions (settings, menu) are triggered by Escape or dedicated keys outside the input, not by typing in the input. The 's' shortcut on TitleScreen becomes unnecessary once there's a proper input — the user will use the UI hints instead.

**Decision: Option B — Escape-based navigation.** The 's' shortcut is removed. The hint text changes from `[s] Settings` to `[Esc] Settings`. The `GameInput`'s `onCancel` callback (triggered by Escape) opens the settings screen. See Appendix C.

---

## 6. MaskedInput Component

### Problem

API key inputs need to show asterisks instead of the actual characters, while still supporting full editing (paste a key, backspace to correct, etc.).

`InputRenderable` doesn't have built-in masking. The text rendered on screen IS the text in the buffer.

### Approach: Intercept Rendering

`MaskedInput` extends `GameInput` and intercepts the display layer. The actual API key text lives in the `InputRenderable`'s buffer (so paste, word nav, undo all work correctly). But before each render, the displayed text is replaced with asterisks.

### Interface

```typescript
// packages/renderer/src/ui/MaskedInput.ts

export interface MaskedInputConfig extends GameInputConfig {
  /** Character to display instead of actual text. Default: "*" */
  maskChar?: string
}

export class MaskedInput extends GameInput {
  // Same API as GameInput — value getter returns the real text,
  // but the visual display shows asterisks.
}
```

### Implementation Strategy

OpenTUI's `InputRenderable` inherits from `TextareaRenderable` → `EditBufferRenderable`. The rendering pipeline reads from an internal `EditBuffer` which stores the actual text. To mask the display:

**Strategy: Shadow buffer** — Maintain two buffers. The real `InputRenderable` displays asterisks. A shadow string holds the actual value. All edits are mirrored:

```typescript
class MaskedInput extends GameInput {
  private realValue = ""
  private maskChar: string

  constructor(renderer: CliRenderer, config: MaskedInputConfig) {
    super(renderer, {
      ...config,
      // Override callbacks to sync shadow buffer
      onChange: (maskedValue) => {
        // Sync: figure out what changed and apply to realValue
        this.syncRealValue(maskedValue)
        config.onChange?.(this.realValue)
      },
      onSubmit: (maskedValue) => {
        config.onSubmit?.(this.realValue)
      },
    })
    this.maskChar = config.maskChar ?? "*"
  }

  get value(): string {
    return this.realValue
  }

  set value(text: string) {
    this.realValue = text
    // Display asterisks in the actual input
    super.value = this.maskChar.repeat(text.length)
  }
}
```

The challenge is keeping `realValue` in sync when the user types, deletes, pastes, or uses undo. Since we're intercepting at the `onChange` level, we can compare the previous masked length to the new masked length to determine what happened:

- **Typed a character**: masked length increased by 1 → append the typed char to realValue at cursor position
- **Deleted a character**: masked length decreased by 1 → remove from realValue at cursor position
- **Pasted text**: masked length increased by N → we need the original paste text

This is fragile. A simpler approach:

**Revised strategy: Intercept paste + key events** — Hook into `onPaste` to capture the original paste text before it's masked. For single character inserts, intercept `handleKeyPress` to capture the raw character. Then replace the display buffer with mask chars while building the real value in the shadow buffer. The cursor position in the masked display maps 1:1 to the real value since every character becomes exactly one mask char.

The concrete sync approach:

```typescript
// On each input change, compare lengths to determine what happened
private syncFromMaskedChange(): void {
  const maskedLen = this.input.value.length
  const realLen = this.realValue.length
  const cursor = this.input.cursorOffset

  if (maskedLen > realLen) {
    // Characters were added — grab from pendingInsert (set by paste/key intercept)
    const inserted = this.pendingInsert ?? this.maskChar.repeat(maskedLen - realLen)
    this.realValue =
      this.realValue.slice(0, cursor - inserted.length) +
      inserted +
      this.realValue.slice(cursor - inserted.length)
    this.pendingInsert = null
  } else if (maskedLen < realLen) {
    // Characters were deleted
    const deleteCount = realLen - maskedLen
    this.realValue =
      this.realValue.slice(0, cursor) +
      this.realValue.slice(cursor + deleteCount)
  }
}
```

This is deterministic because:
- Single char insert: pendingInsert captured from key event
- Paste: pendingInsert captured from paste event
- Delete/backspace: cursor position tells us exactly which chars were removed
- Undo/redo: triggers the same onChange, sync recalculates from cursor + length delta

---

## 7. Screen Migrations

### 7.1 TitleScreen

**Before:** Manual buffer + `onKeyDown` on container, ~25 lines of input logic.

**After:**
```typescript
// In constructor:
this.input = new GameInput(renderer, {
  id: "title-input",
  width: 60,
  placeholder: "Describe your world...",
  onSubmit: (value) => {
    if (value.trim().length > 0) {
      this.resolve?.({ type: "prompt", value: value.trim() })
    }
  },
})
this.container.add(this.input.container)

// In show():
this.input.value = ""
this.input.focus()
```

Escape triggers `onCancel` which opens the settings screen. Hint text updated to `[Esc] Settings`.

**Lines saved:** ~20

### 7.2 OnboardingScreen

**Before:** Manual buffer + phase state machine + masked display, ~30 lines of input logic.

**After:**
```typescript
this.input = new MaskedInput(renderer, {
  id: "onboarding-input",
  width: 60,
  placeholder: "sk-ant-...",
  onSubmit: (value) => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      this.showError("Please enter an API key")
      return
    }
    if (!trimmed.startsWith("sk-")) {
      this.showError("Should start with sk-")
      return
    }
    this.settingsManager.setApiKey("anthropic", trimmed)
    this.phase = "saved"
    this.updateDisplay()
  },
})
```

Phase state machine stays (intro → input → saved) but the input phase is drastically simpler.

**Lines saved:** ~25

### 7.3 SettingsScreen

**Before:** Manual editBuffer + navigation/edit mode switching, ~35 lines of input logic.

**After:** The edit mode creates a temporary `MaskedInput` overlay for the selected provider. Navigation mode stays manual (it's not text input — it's list navigation with arrow keys).

```typescript
private startEditing(): void {
  this.editing = true
  this.editInput = new MaskedInput(this.renderer, {
    id: "settings-edit",
    width: 50,
    placeholder: "Paste API key...",
    onSubmit: (value) => this.saveKey(value),
    onCancel: () => this.cancelEditing(),
  })
  // Replace the provider text with the input
  this.editInput.focus()
}
```

**Lines saved:** ~25

### 7.4 DialoguePanel (Freeform Mode)

**Before:** Manual buffer + custom key handling in `handleFreeformKey`, ~30 lines.

**After:** For the freeform dialogue input, we could use `GameInput` directly since it's visible text (not masked). However, DialoguePanel lives in `@daydream/renderer` and already has a complex state machine. The simplest migration is to use `InputRenderable` directly inside the panel's freeform mode, without the `GameInput` wrapper (it doesn't need the border — the panel has its own layout).

```typescript
private enterFreeform(): void {
  this.freeformInput = new InputRenderable(this.renderer, {
    placeholder: "Type your response...",
    textColor: "#c0caf5",
    onSubmit: () => {
      if (this.freeformInput.value.trim().length > 0) {
        this.resolveOption({ type: "freeform", text: this.freeformInput.value.trim() })
      }
    },
  })
  // Add to panel layout, focus
}
```

**Lines saved:** ~20

### Total Reduction

| Screen | Before | After (est.) | Saved |
|--------|--------|-------------|-------|
| TitleScreen | 25 | 5 | 20 |
| OnboardingScreen | 30 | 5 | 25 |
| SettingsScreen | 35 | 10 | 25 |
| DialoguePanel | 30 | 10 | 20 |
| **Total** | **120** | **30** | **~90 lines** |

Plus ~80 lines for the new `GameInput` and `MaskedInput` components. Net: slight reduction in total code, but the input code is now centralized and feature-complete.

---

## 8. Implementation Plan

### Task Breakdown

```
[1] GameInput component (renderer)
      │
      ├──→ [2] MaskedInput component (renderer)
      │
      └──→ [3] Migrate TitleScreen + OnboardingScreen (game)
               │
               └──→ [4] Migrate SettingsScreen + DialoguePanel (game + renderer)
```

#### Task 1: GameInput Component — `@daydream/renderer`

**Touches:** `packages/renderer/src/ui/GameInput.ts`, `packages/renderer/src/index.ts`

- [ ] Implement `GameInput` class wrapping `InputRenderable` + `BoxRenderable`
- [ ] Standard game styling (colors, border, placeholder)
- [ ] Wire `onSubmit`, `onChange`, `onCancel` callbacks
- [ ] Escape key handling
- [ ] Export from renderer package
- [ ] Test: create GameInput, set value, verify value getter
- [ ] Test: verify onSubmit fires on Enter
- [ ] Test: verify onCancel fires on Escape
- [ ] Manual test: paste, word nav, undo work in a test script

#### Task 2: MaskedInput Component — `@daydream/renderer`

**Touches:** `packages/renderer/src/ui/MaskedInput.ts`, `packages/renderer/src/index.ts`

**Depends on:** Task 1

- [ ] Implement `MaskedInput` extending `GameInput` with shadow buffer
- [ ] Verify paste works with masking (paste real text, display asterisks)
- [ ] Verify undo/redo works with masking
- [ ] Verify word navigation works (on masked text)
- [ ] Export from renderer package
- [ ] Test: value getter returns real text, display shows asterisks
- [ ] Test: paste a string, verify value is real text

#### Task 3: Migrate TitleScreen + OnboardingScreen — `@daydream/game`

**Touches:** `apps/game/src/TitleScreen.ts`, `apps/game/src/OnboardingScreen.ts`

**Depends on:** Tasks 1 and 2

- [ ] Replace TitleScreen manual input with `GameInput`
- [ ] Replace OnboardingScreen manual input with `MaskedInput`
- [ ] Remove all manual buffer management and cursor rendering
- [ ] Verify title screen prompt entry works end-to-end
- [ ] Verify onboarding API key entry works with paste
- [ ] Verify phase state machine still works correctly

#### Task 4: Migrate SettingsScreen + DialoguePanel

**Touches:** `apps/game/src/settings/SettingsScreen.ts`, `packages/renderer/src/ui/DialoguePanel.ts`

**Depends on:** Task 3 (to validate the pattern)

- [ ] Replace SettingsScreen edit mode with `MaskedInput`
- [ ] Replace DialoguePanel freeform with `InputRenderable` (no wrapper needed)
- [ ] Verify settings key editing works
- [ ] Verify dialogue freeform input works
- [ ] Remove all manual buffer management from these files

---

## 9. Appendices

### Appendix A: Use InputRenderable vs. Custom EditBuffer

**Decision:** Use `InputRenderable` with composition (not inheritance).

**Options considered:**

1. **InputRenderable directly** — Use OpenTUI's built-in component as-is.
   - Pros: Zero implementation of editing logic, all features free
   - Cons: Less control over rendering, masking is harder

2. **Custom component on EditBuffer** — Build our own renderable using OpenTUI's `EditBuffer` for text management but custom rendering.
   - Pros: Full visual control, easy masking
   - Cons: Must reimplement keybindings, cursor rendering, paste handling (~200 lines)

3. **InputRenderable with composition** (chosen) — Create `GameInput` that owns an `InputRenderable` and a `BoxRenderable`, exposing a focused API.
   - Pros: All editing features free, visual control via the wrapper, clean API
   - Cons: Masking requires creative approach (shadow buffer)

**Rationale:** Option 3 gives us the best of both worlds. We get all of InputRenderable's editing capabilities without reimplementing them, while maintaining control over the outer presentation (border, colors, layout) and extending behavior (masking, callbacks).

### Appendix B: Masking Strategy

**Decision:** Shadow buffer approach — real text tracked separately, display shows mask characters.

**Options considered:**

1. **Shadow buffer** (chosen) — Keep real text in a parallel string. Display asterisks in the InputRenderable.
   - Pros: Editing features (word nav, selection) work on the mask chars naturally
   - Cons: Syncing shadow buffer with edits is non-trivial

2. **Override rendering** — Let InputRenderable hold real text but intercept the render call.
   - Pros: Clean data model (single source of truth for text)
   - Cons: Requires hooking into OpenTUI internals, fragile

3. **Post-process FrameBuffer** — After InputRenderable renders, overwrite the character cells with asterisks.
   - Pros: No interference with InputRenderable at all
   - Cons: Requires knowing exactly which cells to overwrite, timing-dependent

**Rationale:** Shadow buffer is the most predictable approach. Word navigation on asterisks works fine (all chars are identical, so word boundaries are at the start/end). The sync logic is manageable because `InputRenderable` fires `onChange` events.

### Appendix C: Settings 's' Shortcut on TitleScreen

**Decision:** Remove the 's' shortcut; use Escape to open settings.

**Options considered:**

1. **Remove 's', use Escape** (chosen) — Change hint to `[Esc] Settings`. `GameInput`'s `onCancel` callback opens settings.
   - Pros: Clean separation between input and navigation, no special cases
   - Cons: Slightly less discoverable than a letter shortcut

2. **Split focus** — Tab toggles between input and settings button.
   - Pros: Proper UI pattern, accessible
   - Cons: Over-engineered for a single menu option

3. **Check 's' on submit** — If user types only "s" and submits, treat as settings.
   - Pros: Preserves current shortcut
   - Cons: Prevents entering a world prompt starting with "s"

**Rationale:** Escape is the standard "back/menu" key in the game. The 's' shortcut was an interim solution that conflicts with `InputRenderable` consuming all letter keys. Escape is already understood by users (it opens the menu in gameplay mode).

### Appendix D: DialoguePanel Input Approach

**Decision:** Use `InputRenderable` directly (no `GameInput` wrapper) for dialogue freeform input.

**Rationale:** The DialoguePanel has its own bordered layout and rendering. Adding a `GameInput` (which includes its own border) would create a nested-border visual. The bare `InputRenderable` fits seamlessly into the panel's existing layout while providing full editing capabilities.
