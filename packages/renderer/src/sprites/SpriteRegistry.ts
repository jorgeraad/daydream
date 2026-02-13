// SpriteRegistry — central store for sprite templates
// Manages in-memory template storage, disk-based caching, and lookup/filtering

import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { SpriteTemplate, SpriteCategory } from "./types.ts";
import { DEFAULT_SPRITE_CONFIG } from "./types.ts";

/** Options for filtering sprite templates */
export interface SpriteFindOptions {
  category?: SpriteCategory;
  tags?: string[];
}

/** Resolve a path that may start with ~ to the user's home directory */
function resolvePath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

/**
 * SpriteRegistry — the central store for sprite templates.
 *
 * Responsibilities:
 * - In-memory template storage with O(1) lookup by ID
 * - Disk-based caching for persistence across sessions
 * - Filtering by category and tags
 *
 * This class is independent of rendering — it's pure data management.
 */
export class SpriteRegistry {
  private templates: Map<string, SpriteTemplate> = new Map();
  private builtinIds: Set<string> = new Set();
  private readonly cachePath: string;

  constructor(cachePath?: string) {
    const base = cachePath ?? DEFAULT_SPRITE_CONFIG.cachePath;
    this.cachePath = resolvePath(join(base, "templates.json"));
  }

  /** Number of templates currently registered */
  get size(): number {
    return this.templates.size;
  }

  /** Look up a template by its unique ID. Returns undefined if not found. */
  get(id: string): SpriteTemplate | undefined {
    return this.templates.get(id);
  }

  /** Register a single template. Overwrites any existing template with the same ID. */
  register(template: SpriteTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Register built-in templates. These always overwrite cached versions
   * to ensure version freshness. Call this after `loadCache()` to
   * guarantee built-ins are up to date.
   */
  registerBuiltins(builtins: SpriteTemplate[]): void {
    for (const template of builtins) {
      this.templates.set(template.id, template);
      this.builtinIds.add(template.id);
    }
  }

  /**
   * Find templates matching optional category and/or tags.
   * When tags are provided, a template must contain ALL specified tags (AND logic).
   * Returns an empty array if nothing matches.
   */
  find(options: SpriteFindOptions): SpriteTemplate[] {
    const results: SpriteTemplate[] = [];

    for (const template of this.templates.values()) {
      if (options.category !== undefined && template.category !== options.category) {
        continue;
      }

      if (options.tags !== undefined && options.tags.length > 0) {
        const hasAllTags = options.tags.every((tag) => template.tags.includes(tag));
        if (!hasAllTags) {
          continue;
        }
      }

      results.push(template);
    }

    return results;
  }

  /**
   * Persist all templates to disk as JSON.
   * Creates the cache directory if it doesn't exist.
   */
  async saveCache(): Promise<void> {
    const dir = dirname(this.cachePath);
    await mkdir(dir, { recursive: true });

    const data = Array.from(this.templates.values());
    await Bun.write(this.cachePath, JSON.stringify(data, null, 2));
  }

  /**
   * Load templates from the disk cache.
   * Creates the cache directory if it doesn't exist.
   * Skips templates that would overwrite a built-in (built-ins take precedence).
   * Returns the number of templates loaded from cache.
   */
  async loadCache(): Promise<number> {
    const dir = dirname(this.cachePath);
    await mkdir(dir, { recursive: true });

    const file = Bun.file(this.cachePath);
    const exists = await file.exists();
    if (!exists) {
      return 0;
    }

    const text = await file.text();
    const data: SpriteTemplate[] = JSON.parse(text);

    let count = 0;
    for (const template of data) {
      // Don't overwrite built-in templates with cached versions
      if (!this.builtinIds.has(template.id)) {
        this.templates.set(template.id, template);
        count++;
      }
    }

    return count;
  }
}
