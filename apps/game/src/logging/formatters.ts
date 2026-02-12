import {
  getTextFormatter,
  getJsonLinesFormatter,
  type TextFormatter,
} from "@logtape/logtape";

/** Human-readable text formatter for log files and console. */
export const textFormatter: TextFormatter = getTextFormatter({
  timestamp: "date-time-tz",
  level: "FULL",
  category: ".",
});

/** JSON Lines formatter for machine-parseable log files. */
export const jsonFormatter: TextFormatter = getJsonLinesFormatter({
  categorySeparator: ".",
  message: "rendered",
  properties: "flatten",
});

export type LogFormat = "text" | "json";

/** Get the formatter for the given format name. */
export function getFormatter(format: LogFormat): TextFormatter {
  return format === "json" ? jsonFormatter : textFormatter;
}
