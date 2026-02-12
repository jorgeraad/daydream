# 20260212142949 - Fix renderer not starting before screen input

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 14:29:50 EST |
| **Last Modified**  | 2026-02-12 14:32:33 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | cool-coyote |
| **Blocked-By**     | none |
| **Feature**        | — |
| **Touches**        | apps/game/src/index.ts |
| **References**     | [Design Doc](../../docs/design.md) |

## Description

`renderer.auto()` is only called inside `startGameplay()` (line 384), but the OnboardingScreen and TitleScreen both rely on keyboard input via `onKeyDown` handlers. Since `auto()` is what initializes the stdin listener and render loop, neither screen can receive input — the game appears frozen on launch. Move `renderer.auto()` to right after renderer creation so the input system is active before any screen is shown.

## Acceptance Criteria

- [x] `renderer.auto()` is called immediately after `createCliRenderer()`, before any screen is shown
- [x] The duplicate `renderer.auto()` call in `startGameplay()` is removed
- [ ] OnboardingScreen and TitleScreen can receive keyboard input on launch
- [ ] Gameplay input still works after transitioning from title screen

## Implementation Steps

- [x] Add `renderer.auto()` after `createCliRenderer()` in `main()`
- [x] Remove `renderer.auto()` from `startGameplay()`

## Progress Log

### 2026-02-12 14:29:50 EST
Initial creation. Bug discovered during investigation of frozen input on game launch — `renderer.auto()` deadlock between screen input and gameplay startup.

### 2026-02-12 14:30:12 EST
Starting work on branch `main`. Two-line fix — move `renderer.auto()` up and remove the old call. No touches overlap with in-progress tasks (AI Dialogue touches different files in `apps/game/src/`).

### 2026-02-12 14:30:59 EST
Completed. Added `renderer.auto()` on line 396 (right after `createCliRenderer()`), removed the duplicate call that was at the end of `startGameplay()`. Typecheck passes for the changed file; pre-existing errors in other test files are unrelated. Two acceptance criteria (manual testing: screen input works, gameplay input works) need user verification.

### 2026-02-12 14:32:33 EST
Committed and merged to main.
