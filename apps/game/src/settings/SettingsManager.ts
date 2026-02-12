import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Provider registry — maps provider name to env var fallback */
const PROVIDERS: Record<string, { envVar: string; label: string }> = {
  anthropic: { envVar: "ANTHROPIC_API_KEY", label: "Anthropic" },
};

export interface ProviderInfo {
  name: string;
  label: string;
  configured: boolean;
}

export class SettingsManager {
  private basePath: string;
  private credentialsPath: string;
  private settingsPath: string;
  private credentials: Record<string, string> = {};
  private settings: Record<string, unknown> = {};

  constructor(options?: { basePath?: string }) {
    this.basePath = options?.basePath ?? join(homedir(), ".daydream");
    this.credentialsPath = join(this.basePath, "credentials.json");
    this.settingsPath = join(this.basePath, "settings.json");
  }

  /** Ensure the base directory exists and load stored data. */
  init(): void {
    mkdirSync(this.basePath, { recursive: true });
  }

  /** Load credentials and settings from disk. */
  load(): void {
    this.init();
    this.credentials = this.readJson(this.credentialsPath);
    this.settings = this.readJson(this.settingsPath);
  }

  /** Get an API key for a provider. Checks stored credentials first, then env var. */
  getApiKey(provider: string): string | undefined {
    const stored = this.credentials[provider];
    if (stored) return stored;

    const providerDef = PROVIDERS[provider];
    if (providerDef) {
      return process.env[providerDef.envVar];
    }
    return undefined;
  }

  /** Store an API key for a provider. Writes credentials.json with 0600 permissions. */
  setApiKey(provider: string, key: string): void {
    this.credentials[provider] = key;
    this.writeCredentials();
  }

  /** Remove an API key for a provider. */
  removeApiKey(provider: string): void {
    delete this.credentials[provider];
    this.writeCredentials();
  }

  /** Check if an API key is available for a provider (stored or env). */
  hasApiKey(provider: string): boolean {
    return this.getApiKey(provider) !== undefined;
  }

  /** Return all known providers with their configured status. */
  getProviders(): ProviderInfo[] {
    return Object.entries(PROVIDERS).map(([name, def]) => ({
      name,
      label: def.label,
      configured: this.hasApiKey(name),
    }));
  }

  /** Mask an API key for display: first 6 chars + ... + last 4 chars. */
  static maskApiKey(key: string): string {
    if (key.length <= 12) return "****";
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  private writeCredentials(): void {
    writeFileSync(this.credentialsPath, JSON.stringify(this.credentials, null, 2), {
      mode: 0o600,
    });
  }

  /** Read a nested setting by dot-separated key (e.g., "logging.level"). */
  get<T = unknown>(key: string): T | undefined {
    const parts = key.split(".");
    let current: unknown = this.settings;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current as T;
  }

  /** Write a nested setting by dot-separated key and persist to disk. */
  set(key: string, value: unknown): void {
    const parts = key.split(".");
    let current = this.settings;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
        (current as Record<string, unknown>)[part] = {};
      }
      current = (current as Record<string, unknown>)[part] as Record<string, unknown>;
    }
    (current as Record<string, unknown>)[parts[parts.length - 1]!] = value;
    this.writeSettings();
  }

  private writeSettings(): void {
    writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
  }

  private readJson(path: string): Record<string, string> {
    if (!existsSync(path)) return {};
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return {};
    }
  }
}
