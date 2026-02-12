# 20260212133127 - Design Doc: Music & Sound Effects System

| Field              | Value |
|--------------------|-------|
| **Created**        | 2026-02-12 13:31:27 EST |
| **Last Modified**  | 2026-02-12 14:34:26 EST |
| **Status**         | in-progress |
| **Branch**         | main |
| **Agent**          | deep-finch |
| **Blocked-By**     | none |
| **Feature**        | audio |
| **Touches**        | .jraad/docs/design-docs/20260212143111-music-sound-effects.md |
| **References**     | [Design Doc](../../docs/design.md), [PRD](../../docs/prd.md) |

## Description

Write a design document for AI-generated music and sound effects. The system should generate simple 8-bit style game music on-the-fly (matching the AI-native generation approach used elsewhere), support looping playback, and include user settings for toggling music and sound effects independently. Use `/design-doc` to drive the iterative design process.

Key areas to design:
- **Audio playback engine**: Library/API selection for terminal audio playback, format constraints
- **AI music generation pipeline**: Prompt design, model/service selection, generation flow, caching strategy
- **8-bit style constraints**: Generation parameters to keep music simple and retro
- **Looping strategy**: Seamless loop points, crossfade, transition handling between zones/screens
- **Sound effects**: Trigger system, effect types (movement, interaction, ambient), catalog
- **Settings API**: Enable/disable music, enable/disable SFX, volume control, persistence
- **Integration**: How settings tie into the existing settings system (20260212130954)
- **Performance**: Resource management, memory footprint, CPU impact on game rendering

## Acceptance Criteria

- [ ] Design document written and approved via `/design-doc` process
- [ ] Covers audio playback approach for terminal environments (library/API selection)
- [ ] Covers AI music generation pipeline (prompt → audio, model/service selection)
- [ ] Covers 8-bit style constraints and generation parameters
- [ ] Covers looping strategy (seamless loops, transition handling)
- [ ] Covers sound effects catalog and trigger system
- [ ] Covers settings schema (music on/off, SFX on/off, volume)
- [ ] Covers integration with existing settings system
- [ ] Addresses performance and resource management

## Implementation Steps

- [x] Research audio playback libraries for Node.js/Bun terminal apps
- [x] Research AI music generation APIs/services
- [x] Draft design doc using `/design-doc` process
- [ ] Iterate on design based on feedback
- [ ] Finalize design doc

## Progress Log

### 2026-02-12 13:31:27 EST
Initial creation. User request for music & sound effects design doc covering AI-generated 8-bit music, looping, SFX, and settings toggles.

### 2026-02-12 13:33:20 EST
Starting implementation on branch `main`. No dependencies (Blocked-By: none). No Touches overlap with in-progress tasks. Will use `/design-doc` to drive iterative design process.

### 2026-02-12 13:41:35 EST
Research complete and initial draft written at `.jraad/docs/music-sound-design.md`. Key decisions:
- **Playback**: CLI player wrapper via `Bun.spawn()` (mpv preferred, mpg123/afplay fallback). No Bun-native audio libs exist.
- **Music generation**: Hybrid approach — Claude generates structured `MusicSpec` (haiku, ~$0.0003/gen), procedural `ChiptuneEngine` synthesizes authentic 8-bit WAV audio. Zero latency, perfect looping.
- **SFX**: Procedural generation (sfxr-style parameter synthesis), triggered via EventBus events.
- **Settings**: `AudioSettings` Zod schema integrated into existing `SettingsManager`. Music/SFX toggles, volume controls.
- **Architecture**: New `@daydream/audio` package parallel to renderer.
- Rejected alternatives: AI audio generation APIs (latency, cost, no seamless loops), Bun FFI to native audio (too complex), Tone.js (browser-only).
Awaiting user review before finalizing.

### 2026-02-12 14:34:26 EST
Moved design doc to proper location: `.jraad/docs/design-docs/20260212143111-music-sound-effects.md`. Added proper metadata header (Created, Last Modified, Status: draft, Author, Task reference). Expanded content with more detailed code examples (WAV encoder, oscillator implementations, AudioPlayer full API), added Appendix B (audio player compatibility matrix), expanded architecture data flow diagrams. Updated Touches field.
