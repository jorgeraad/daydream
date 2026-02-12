import { configure, getConsoleSink, type LogLevel, isLogLevel } from "@logtape/logtape";
import { getRotatingFileSink } from "@logtape/file";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { getFormatter, type LogFormat } from "./formatters.ts";

export interface LoggingConfig {
  level: LogLevel;
  format: LogFormat;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  console?: boolean;
  /** Per-category level overrides. Keys are dot-separated category paths (e.g., "ai.client"). */
  filters?: Record<string, LogLevel>;
}

const DEFAULT_LOG_DIR = join(homedir(), ".daydream", "logs");
const DEFAULT_LOG_FILE = join(DEFAULT_LOG_DIR, "daydream.log");

const DEFAULTS: Required<LoggingConfig> = {
  level: "info",
  format: "text",
  filePath: DEFAULT_LOG_FILE,
  maxFileSize: 5_242_880, // 5 MB
  maxFiles: 5,
  console: false,
  filters: {},
};

/**
 * Configure LogTape logging for the entire application.
 *
 * Reads defaults, merges user config, then applies environment variable overrides.
 * Call this once at startup, before any other initialization.
 * Can be called again to reconfigure (e.g., when in-game settings change).
 */
export async function configureLogging(
  userConfig?: Partial<LoggingConfig>,
): Promise<void> {
  const envConfig = readEnvConfig();
  const config: Required<LoggingConfig> = {
    ...DEFAULTS,
    ...userConfig,
    ...envConfig,
  };

  // Ensure log directory exists
  const logDir = config.filePath.substring(
    0,
    config.filePath.lastIndexOf("/"),
  );
  mkdirSync(logDir, { recursive: true });

  const formatter = getFormatter(config.format);

  // Build sinks
  const sinks: Record<string, ReturnType<typeof getRotatingFileSink> | ReturnType<typeof getConsoleSink>> = {
    file: getRotatingFileSink(config.filePath, {
      maxSize: config.maxFileSize,
      maxFiles: config.maxFiles,
      formatter,
    }),
  };

  if (config.console) {
    sinks.console = getConsoleSink();
  }

  // Build logger configs — root logger + per-category overrides
  const sinkIds = Object.keys(sinks);
  const loggers: Array<{
    category: string | string[];
    lowestLevel: LogLevel;
    sinks: string[];
  }> = [
    {
      category: ["daydream"],
      lowestLevel: config.level,
      sinks: sinkIds,
    },
  ];

  // Apply per-category level overrides (from LOG_FILTER env var or programmatic config)
  for (const [categoryPath, level] of Object.entries(config.filters)) {
    loggers.push({
      category: ["daydream", ...categoryPath.split(".")],
      lowestLevel: level,
      sinks: sinkIds,
    });
  }

  await configure({ sinks, loggers, reset: true });
}

/** Read configuration overrides from environment variables. */
function readEnvConfig(): Partial<LoggingConfig> {
  const config: Partial<LoggingConfig> = {};

  const level = process.env.LOG_LEVEL;
  if (level && isLogLevel(level)) {
    config.level = level;
  }

  const format = process.env.LOG_FORMAT;
  if (format === "json" || format === "text") {
    config.format = format;
  }

  if (process.env.LOG_FILE) {
    config.filePath = process.env.LOG_FILE;
  }

  if (process.env.LOG_CONSOLE === "1") {
    config.console = true;
  }

  const filterStr = process.env.LOG_FILTER;
  if (filterStr) {
    config.filters = {};
    for (const pair of filterStr.split(",")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const cat = pair.substring(0, eqIdx).trim();
      const lvl = pair.substring(eqIdx + 1).trim();
      if (cat && isLogLevel(lvl)) {
        config.filters[cat] = lvl;
      }
    }
  }

  return config;
}
