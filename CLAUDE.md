# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Daydream is an AI-native terminal game where worlds are generated from text prompts. Full requirements in `.jraad/docs/prd.md`, technical design in `.jraad/docs/design.md`.

## Commands

```bash
bun run dev          # Run the game (apps/game/src/index.ts)
bun run start        # Same, via direct path
bun run typecheck    # tsc --build (composite project references)
bun run build        # Build all workspaces
bun run test         # Run all workspace tests
bun test <file>      # Run a single test file
```

## Architecture

Bun monorepo, 4 packages with this dependency graph:

```
@daydream/game (apps/game)
├── @daydream/engine   (core types, WorldState, EventBus, Chronicle)
├── @daydream/ai       (Claude API client, prompts, tool schemas)
└── @daydream/renderer (TileRenderer, ViewportManager, biome palettes)
    └── @daydream/engine
```

**engine** is the foundation — it defines the type system that all other packages depend on. Types live in `packages/engine/src/types.ts`. Key abstractions: `WorldState` (in-memory world), `EventBus` (typed pub/sub), `Chronicle` (append-only narrative log).

**ai** wraps `@anthropic-ai/sdk`. `AIClient` selects models by task type (opus for world creation, haiku for compression). `ContextManager` assembles budget-aware prompts from context blocks. Tool schemas in `packages/ai/src/tools/` define what Claude can output.

**renderer** uses OpenTUI (`@opentui/core`) for terminal rendering. `TileRenderer` draws zones layer-by-layer (ground → objects → overlay) into a `FrameBufferRenderable`. `ViewportManager` handles camera tracking and coordinate transforms. Biome palettes in `packages/renderer/src/palettes/`.

**game** is the entry point that wires everything together.

## Type Safety and Zod

**Direction:** All structured data should be defined as Zod schemas, with TypeScript types derived via `z.infer<>`. This eliminates duplicate type/schema definitions and enables runtime validation.

Currently, tool schemas in `packages/ai/src/tools/` are hand-written JSON Schema objects with separate TypeScript interfaces — these are duplicates that can drift. Response parsers use unsafe `as` casts (e.g., `toolUse.input as ZoneSpec`). The planned migration:

1. Define Zod schemas as the single source of truth
2. Derive TypeScript types with `z.infer<>`
3. Derive JSON Schema for Claude tool definitions from Zod (via `zod-to-json-schema` or equivalent)
4. Validate AI responses with `.parse()` / `.safeParse()` instead of `as` casts

When adding new types or modifying existing ones, follow this pattern. Never duplicate a type definition as both a `type`/`interface` and a separate schema — one must derive from the other.

## Conventions

- **Bun workspaces** use object format with `catalog` for shared dependency versions (not array format)
- **tsconfig** uses `emitDeclarationOnly` (not `noEmit`) because `tsc --build` with project references requires emit. Root `tsconfig.json` has project references; `tsconfig.base.json` has shared compiler options
- **OpenTUI API** — see memory file at `.claude/projects/-Users-jraad-projects-daydream/memory/opentui-notes.md` for detailed reference. Key: renderer is async (`await createCliRenderer()`), use `renderer.auto()` to start, `renderer.destroy()` to clean up
- **Tile coordinates** use flat arrays indexed as `y * width + x`
- **Zone IDs** follow the format `zone_X_Y` (see `zoneId()` in `packages/engine/src/world/Zone.ts`)
- **Player** renders as `@` (bold white on black) — standard roguelike convention
