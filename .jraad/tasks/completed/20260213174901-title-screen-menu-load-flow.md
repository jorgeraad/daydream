# 20260213174901 - Title Screen Menu & World Load Flow

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-13 17:49:01 EST |
| **Last Modified**  | 2026-02-13 17:58:46 EST |
| **Status**         | completed |
| **Branch**         | main |
| **Agent**          | deep-otter |
| **Blocked-By**     | 20260213174841 |
| **Feature**        | world-resume |
| **Touches**        | apps/game/src/TitleScreen.ts, apps/game/src/index.ts, apps/game/src/__tests__/title-screen-menu.test.ts |
| **References**     | [Design Doc](../../docs/design.md), [Persistence Task](../merged/20260212114217-persistence.md) |

## Description

Transform the TitleScreen into a context-aware main menu that detects saved worlds and offers resume options. Wire a complete "load world" flow in index.ts that bypasses world generation and restores a saved game directly into gameplay.

**UX behavior:**
- **No saved worlds**: Show the current prompt-only title screen (unchanged behavior)
- **Saved worlds exist**: Show a main menu with options:
  1. **Continue** — Resume the most recently played world (one-key shortcut)
  2. **New World** — Enter a prompt to create a new world (shows input field)
  3. **Browse Worlds** — Open the WorldBrowser to pick from all saves
  4. **Settings** — Open settings screen

The Continue option provides instant gratification — press Enter and you're back in your last world. Browse Worlds gives full control for users with multiple saves.

## Acceptance Criteria

- [x] TitleScreen detects saved worlds via SaveManager.listWorlds() on show()
- [x] When no saves exist: shows current prompt-only UI (backward compatible)
- [x] When saves exist: shows menu with Continue / New World / Browse Worlds / Settings
- [x] Continue option shows the most recent world's name and prompt snippet
- [x] Arrow keys navigate menu, Enter selects, keyboard shortcuts (C/N/B/S) also work
- [x] New result types: `{ type: "continue", worldId: string }` and `{ type: "load", worldId: string }`
- [x] index.ts handles "continue" and "load" results by loading the world via SaveManager.loadWorld()
- [x] Load flow: SaveManager.loadWorld() → reconstruct ZoneData from active zone → create ZoneManager → start gameplay (skip generation entirely)
- [x] Loading shows a brief loading screen ("Resuming world...")
- [x] Player resumes at their saved position in their last active zone
- [x] All previously discovered zones are available via ZoneManager
- [x] Auto-save wired for loaded worlds (same as new worlds)
- [x] Characters restored from save and rendered in their saved positions
- [x] Tests for menu mode detection (saves vs no saves) and load flow
- [x] Typecheck passes

## Implementation Steps

- [x] Extend TitleScreenResult type with "continue", "load", and "browse" variants
- [x] Add menu mode to TitleScreen: detect saves, render menu options, handle navigation
- [x] Show most recent world info in the Continue option
- [x] Wire WorldBrowser into index.ts for "Browse Worlds" flow
- [x] Add load flow in index.ts: handle continue/load results
- [x] Implement world loading: SaveManager → WorldState → ZoneData reconstruction → ZoneManager setup
- [x] Skip world generation path when loading
- [x] Wire auto-save for loaded worlds
- [x] Write tests for menu detection and load flow
- [x] Verify typecheck passes

## Progress Log

### 2026-02-13 17:49:01 EST
Initial creation. Blocked by WorldBrowser screen (20260213174841) since the "Browse Worlds" menu option opens the WorldBrowser component. The SaveManager.loadWorld() API is already implemented — this task wires it into the game flow.

### 2026-02-13 17:54:24 EST
Starting work on branch `main`. Agent: deep-otter. Reading existing source files to understand TitleScreen, index.ts flow, WorldBrowser, and SaveManager APIs.

### 2026-02-13 17:58:46 EST
Implementation complete. All acceptance criteria met.

**TitleScreen changes:** Extended TitleScreenResult with `continue`, `load`, and `browse` variants. Added dual-mode UI: when SaveManager.listWorlds() returns saves, shows a 4-item menu (Continue/New World/Browse Worlds/Settings) with arrow key navigation, Enter selection, and C/N/B/S keyboard shortcuts. Continue option displays the most recent world's prompt snippet and play time via formatPlayTime/truncatePrompt (reused from WorldBrowser). When no saves exist, shows the original prompt-only UI (fully backward compatible). "New World" switches from menu to prompt input mode; Escape returns to menu.

**index.ts changes:** Refactored the main() function to separate concerns into `loadAndStartWorld()` and `generateAndStartWorld()` helper functions. The title screen loop now handles all result types: settings (loop back), browse (show WorldBrowser, map select to load result, loop back on back), continue/load (load existing world), prompt (generate new world). The load flow: creates SaveManager, calls loadWorld(), gets active zone, converts to ZoneData, restores player position, collects all characters, creates AIClient + WorldGenerator + ZoneManager, activates the active zone (all saved zones available via WorldState.zones through the zoneStore), starts gameplay, and wires auto-save. Sprite registry initialization moved before the title screen loop so it's available for both flows.

**Tests:** 23 tests covering TitleScreenResult type variants, menu mode detection logic, menu item construction, selection logic, load flow routing, and keyboard shortcut mapping. All 122 tests across 10 test files pass. Typecheck passes (no new errors in modified files; pre-existing test file errors unchanged).
