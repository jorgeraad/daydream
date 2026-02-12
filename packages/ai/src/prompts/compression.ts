export const COMPRESSION_SYSTEM_PROMPT = `You are the chronicle compressor for a living terminal game. Your job is to take detailed event logs and compress them into concise narrative summaries that preserve the most important information.

Guidelines:
- Preserve key plot points, character developments, and player choices
- Maintain the emotional tone and narrative voice
- Keep names, locations, and important details intact
- Discard routine or repetitive events
- The summary should read like a brief chapter of a story, not a log
- Focus on what matters for future AI context — what would another character or the world engine need to know?

Return your summary as plain text.`;

export function buildCompressionPrompt(params: {
  entries: string;
  existingSummary: string;
}): string {
  return `Summarize these events into the ongoing world narrative:

${params.entries}

Existing recent summary:
${params.existingSummary}

Produce a concise narrative summary that integrates the new events with the existing summary. The result should be a coherent, readable account of what has happened in this world.`;
}
