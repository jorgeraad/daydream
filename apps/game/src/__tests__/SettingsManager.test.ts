import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SettingsManager } from "../settings/SettingsManager.ts";

function makeTempDir(): string {
  const dir = join(tmpdir(), `daydream-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("SettingsManager", () => {
  let tempDir: string;
  let manager: SettingsManager;

  beforeEach(() => {
    tempDir = makeTempDir();
    manager = new SettingsManager({ basePath: tempDir });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("init() creates the base directory", () => {
    const nested = join(tempDir, "nested", "dir");
    const m = new SettingsManager({ basePath: nested });
    m.init();
    const stat = statSync(nested);
    expect(stat.isDirectory()).toBe(true);
  });

  it("load() works with no existing files", () => {
    manager.load();
    expect(manager.getApiKey("anthropic")).toBeUndefined();
  });

  it("setApiKey / getApiKey round-trip", () => {
    manager.load();
    manager.setApiKey("anthropic", "sk-ant-test-key-123");
    expect(manager.getApiKey("anthropic")).toBe("sk-ant-test-key-123");
  });

  it("persists across instances", () => {
    manager.load();
    manager.setApiKey("anthropic", "sk-ant-persisted");

    const manager2 = new SettingsManager({ basePath: tempDir });
    manager2.load();
    expect(manager2.getApiKey("anthropic")).toBe("sk-ant-persisted");
  });

  it("removeApiKey removes the key", () => {
    manager.load();
    manager.setApiKey("anthropic", "sk-ant-to-remove");
    expect(manager.hasApiKey("anthropic")).toBe(true);

    manager.removeApiKey("anthropic");
    expect(manager.getApiKey("anthropic")).toBeUndefined();
    expect(manager.hasApiKey("anthropic")).toBe(false);
  });

  it("env var fallback when no file key exists", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    try {
      process.env.ANTHROPIC_API_KEY = "sk-ant-from-env";
      manager.load();
      expect(manager.getApiKey("anthropic")).toBe("sk-ant-from-env");
    } finally {
      if (original !== undefined) {
        process.env.ANTHROPIC_API_KEY = original;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  it("file key takes precedence over env var", () => {
    const original = process.env.ANTHROPIC_API_KEY;
    try {
      process.env.ANTHROPIC_API_KEY = "sk-ant-from-env";
      manager.load();
      manager.setApiKey("anthropic", "sk-ant-from-file");
      expect(manager.getApiKey("anthropic")).toBe("sk-ant-from-file");
    } finally {
      if (original !== undefined) {
        process.env.ANTHROPIC_API_KEY = original;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  it("credentials file written with 0600 permissions", () => {
    manager.load();
    manager.setApiKey("anthropic", "sk-ant-perms-test");

    const credPath = join(tempDir, "credentials.json");
    const stat = statSync(credPath);
    // 0o600 = owner read+write only (octal 33216 on some systems, check mode bits)
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("getProviders returns all known providers with status", () => {
    manager.load();
    const providers = manager.getProviders();
    expect(providers.length).toBeGreaterThan(0);

    const anthropic = providers.find((p) => p.name === "anthropic");
    expect(anthropic).toBeDefined();
    expect(anthropic!.label).toBe("Anthropic");
    expect(anthropic!.configured).toBe(false);

    manager.setApiKey("anthropic", "sk-test");
    const updated = manager.getProviders();
    expect(updated.find((p) => p.name === "anthropic")!.configured).toBe(true);
  });

  it("handles corrupt JSON gracefully", () => {
    manager.init();
    const credPath = join(tempDir, "credentials.json");
    const { writeFileSync } = require("node:fs");
    writeFileSync(credPath, "not valid json{{{", { mode: 0o600 });

    manager.load();
    expect(manager.getApiKey("anthropic")).toBeUndefined();
  });

  it("maskApiKey masks correctly", () => {
    expect(SettingsManager.maskApiKey("sk-ant-api03-abcdefghijklmnop")).toBe("sk-ant...mnop");
    expect(SettingsManager.maskApiKey("short")).toBe("****");
    expect(SettingsManager.maskApiKey("exactly12ch")).toBe("****");
    expect(SettingsManager.maskApiKey("exactly13char")).toBe("exactl...char");
  });

  it("hasApiKey returns false for unknown providers", () => {
    manager.load();
    expect(manager.hasApiKey("unknown_provider")).toBe(false);
  });
});
