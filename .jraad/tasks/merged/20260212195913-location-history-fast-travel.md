# 20260212195913 - Location History & Fast Travel

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 19:59:13 EST |
| **Last Modified**  | 2026-02-12 20:31:13 EST |
| **Status**         | merged |
| **Branch**         | main |
| **Agent**          | sharp-newt |
| **Blocked-By**     | 20260212195902 |
| **Feature**        | multi-zone-world |
| **Touches**        | apps/game/src/LocationBrowser.ts, packages/renderer/src/ui/LocationList.ts, apps/game/src/GameShell.ts, apps/game/src/InputRouter.ts |
| **References**     | [Multi-Zone Design Doc](../../docs/design-docs/20260212143327-multi-zone-world.md) |

## Description

Add a location history screen showing all previously visited zones. Player can browse the list and select a zone to fast-travel back to. Uses PlayerState.journal.discoveredZones for tracking. Pressing M (map) in exploration mode opens the location browser. Shows zone name, biome, coordinates, and last visited time. Selecting a zone triggers fast-travel via ZoneManager.activateZone() with a fade transition.

## Acceptance Criteria

- [x] LocationBrowser component shows list of discovered zones with name, biome, coords, last visited
- [x] Zones sorted by last visited (most recent first)
- [x] Arrow keys navigate the list, Enter selects a zone, Esc closes the browser
- [x] Selecting a zone triggers fast-travel (fade transition via TransitionManager to selected zone)
- [x] Fast-travel loads zone from SQLite via ZoneManager if not in memory
- [x] M key in exploration mode opens the location browser
- [x] Current zone highlighted distinctly in the list
- [x] InputRouter handles "map" mode for browser navigation
- [x] Works gracefully with 0 discovered zones (shows "no locations discovered" message)

## Implementation Steps

- [x] Create `packages/renderer/src/ui/LocationList.ts` — scrollable list UI component
- [x] Export LocationList from renderer package index
- [x] Create `apps/game/src/LocationBrowser.ts` — game-layer location browser
- [x] Add "map" mode handler to InputRouter
- [x] Wire M key, map mode handling, and fast-travel in `apps/game/src/index.ts`
- [x] Run typecheck and tests

## Progress Log

### 2026-02-12 19:59:13 EST
Initial creation. User-requested feature for browsing visited locations and fast-traveling back. Blocked by GameShell multi-zone integration (20260212195902). Touches overlap with portal prompt task (20260212195917) on GameShell.ts and InputRouter.ts — that task is sequenced after this one.

### 2026-02-12 20:28:53 EST
Starting work on branch `main`. Agent: sharp-newt. Dependency 20260212195902 is in merged/. No in-progress tasks overlap on Touches. Implementing LocationList (renderer), LocationBrowser (game), InputRouter map mode, and index.ts wiring.

### 2026-02-12 20:31:13 EST
Task completed. All acceptance criteria met. Created LocationList (renderer UI component) and LocationBrowser (game-layer overlay). Modified InputRouter to add "map" mode with setMapHandler(). Modified index.ts to wire M key, map mode events, and fast-travel via TransitionManager + ZoneManager. Typecheck passes (no new errors). All 69 game tests and 87 renderer tests pass.

### 2026-02-12 21:04:28 EST
Branch merged to main.
