import { configure, type LogRecord } from "@logtape/logtape";

export interface CapturedLog {
  level: string;
  category: readonly string[];
  message: string;
  properties: Record<string, unknown>;
}

/**
 * Create an in-memory LogTape test sink. Use in your test file:
 *
 * ```ts
 * const { install, teardown, getLogs, clearLogs } = createTestLogSink();
 * beforeAll(install);
 * afterAll(teardown);
 * beforeEach(clearLogs);
 * ```
 */
export function createTestLogSink() {
  const logs: CapturedLog[] = [];

  const testSink = (record: LogRecord) => {
    logs.push({
      level: record.level,
      category: record.category,
      message: record.message
        .map((m) => (typeof m === "string" ? m : JSON.stringify(m)))
        .join(""),
      properties: record.properties,
    });
  };

  return {
    install: async () => {
      await configure({
        sinks: { test: testSink },
        loggers: [
          { category: ["daydream"], lowestLevel: "trace", sinks: ["test"] },
        ],
        reset: true,
      });
    },
    teardown: async () => {
      await configure({ sinks: {}, loggers: [], reset: true });
    },
    getLogs: () => logs,
    clearLogs: () => {
      logs.length = 0;
    },
  };
}
