import { type CliRenderer } from "@opentui/core";
import { GameInput, type GameInputConfig } from "./GameInput.ts";

export interface MaskedInputConfig extends GameInputConfig {
  /** Character to display instead of actual text. Default: "*" */
  maskChar?: string;
}

/**
 * MaskedInput — extends GameInput with shadow buffer masking.
 *
 * The display shows mask characters (default: asterisks) while the real text
 * is tracked in a parallel shadow buffer. Supports all standard editing
 * operations (paste, undo/redo, word deletion, etc.) while maintaining sync
 * between the shadow buffer and the masked display.
 *
 * Usage:
 *   const input = new MaskedInput(renderer, {
 *     id: "api-key",
 *     placeholder: "sk-ant-...",
 *     onSubmit: (realValue) => saveKey(realValue),
 *   });
 *   // input.value returns the real text, display shows "****..."
 */
export class MaskedInput extends GameInput {
  private realValue = "";
  private readonly maskChar: string;

  /**
   * Pending insert text captured from key/paste events.
   * Accumulated BEFORE the edit happens (onKeyDown fires before handleKeyPress).
   * Multiple rapid keystrokes may fire before a single onContentChange,
   * so we accumulate rather than replace. Consumed when onContentChange fires.
   */
  private pendingInsert: string | null = null;

  /** Re-entrancy guard: prevents onContentChange from firing when we replace display text. */
  private syncing = false;

  /** User-provided callbacks, stored so we can call them after sync. */
  private userOnChange?: (value: string) => void;
  private userOnCancel?: () => void;

  constructor(renderer: CliRenderer, config: MaskedInputConfig) {
    // Pass config to GameInput but WITHOUT onChange/onCancel — we'll wire those ourselves.
    // onSubmit is fine because GameInput's "enter" listener calls `this.value`,
    // and our overridden getter returns realValue (polymorphism).
    super(renderer, {
      ...config,
      onChange: undefined,
      onCancel: undefined,
    });

    this.maskChar = config.maskChar ?? "*";
    this.userOnChange = config.onChange;
    this.userOnCancel = config.onCancel;

    // Set initial value through our setter (masks the display)
    if (config.value) {
      this.value = config.value;
    }

    // Wire onKeyDown: capture typed characters + handle escape.
    // onKeyDown fires BEFORE handleKeyPress processes the edit.
    this.input.onKeyDown = (key) => {
      // Handle escape for cancel
      if (key.name === "escape") {
        this.userOnCancel?.();
        return;
      }

      // Capture printable characters for the shadow buffer.
      // A printable key has a single character in `key.sequence` (or `key.raw`)
      // and is not a control/meta key combo.
      // We accumulate chars because multiple onKeyDown events may fire
      // before a single onContentChange (e.g., rapid typing via typeText).
      if (
        !key.ctrl &&
        !key.meta &&
        key.sequence.length === 1 &&
        key.sequence >= " "
      ) {
        this.pendingInsert =
          (this.pendingInsert ?? "") + key.sequence;
      }
    };

    // Wire onPaste: capture real paste text before InputRenderable processes it.
    // The paste handler fires, then InputRenderable.handlePaste() inserts the text.
    this.input.onPaste = (event) => {
      this.pendingInsert = event.text;
    };

    // Wire onContentChange: sync shadow buffer, replace display with mask chars.
    this.input.onContentChange = () => {
      // Guard against re-entrant calls from setting this.input.value below.
      if (this.syncing) return;

      this.syncFromMaskedChange();

      // Replace display buffer with mask characters.
      // We need to preserve cursor position across this replacement.
      const cursor = this.input.cursorOffset;
      this.syncing = true;
      this.input.value = this.maskChar.repeat(this.realValue.length);
      this.syncing = false;
      this.input.cursorOffset = cursor;

      this.userOnChange?.(this.realValue);
    };
  }

  /** Get the real (unmasked) text value. */
  override get value(): string {
    return this.realValue;
  }

  /** Set the text value programmatically. Display shows mask characters. */
  override set value(text: string) {
    this.realValue = text;
    // Set the display to mask characters, with re-entrancy guard
    this.syncing = true;
    this.input.value = this.maskChar.repeat(text.length);
    this.syncing = false;
  }

  /**
   * Sync the shadow buffer from a masked content change.
   *
   * Uses cursor position + length delta to determine what happened:
   * - If length increased: characters were added (from pendingInsert or mask chars as fallback)
   * - If length decreased: characters were deleted (cursor tells us which ones)
   * - If length unchanged: cursor movement or no-op — nothing to sync
   */
  private syncFromMaskedChange(): void {
    const maskedLen = this.input.value.length;
    const realLen = this.realValue.length;
    const cursor = this.input.cursorOffset;

    if (maskedLen > realLen) {
      // Characters were added
      const insertCount = maskedLen - realLen;
      const inserted =
        this.pendingInsert ?? this.maskChar.repeat(insertCount);
      // The cursor is now AFTER the inserted text, so the insertion point is:
      //   cursor - insertedLength
      const insertPos = cursor - inserted.length;
      this.realValue =
        this.realValue.slice(0, insertPos) +
        inserted +
        this.realValue.slice(insertPos);
      this.pendingInsert = null;
    } else if (maskedLen < realLen) {
      // Characters were deleted
      const deleteCount = realLen - maskedLen;
      // The cursor is at the position AFTER the deletion.
      // Characters from cursor to cursor+deleteCount were removed.
      this.realValue =
        this.realValue.slice(0, cursor) +
        this.realValue.slice(cursor + deleteCount);
      this.pendingInsert = null;
    }
    // If equal length, no text change (cursor movement, etc.) — nothing to sync.
  }
}
