// ── Music Generation Prompt ──────────────────────────────────

export const MUSIC_GENERATION_SYSTEM_PROMPT = `You are composing 8-bit chiptune music for a terminal game zone.

Compose a short, loopable 8-bit music pattern that evokes the environment described.
Use 2-4 channels. Keep the loop tight (2-8 measures).
Prefer pentatonic or modal scales for a classic game feel.
Use the noise channel for rhythm if appropriate.

Guidelines:
- Square waves: melody and harmony (vary duty cycle for timbral contrast)
- Triangle wave: bass lines (lower register, smooth tone)
- Sawtooth: lead melodies or bright harmonies
- Noise: percussion patterns (hi-hats, snares via frequency)
- Use rests (pitch=0) for rhythmic interest
- Keep velocity variation subtle (10-15 range for most notes)
- Match the mood and atmosphere to the zone description
- Use minor keys for dark/mysterious zones, major for cheerful/peaceful zones
- Slower tempos (60-90 BPM) for calm areas, faster (100-160) for tense/active areas

Use the generate_music tool to return your composition as structured data.`;

export interface MusicGenerationContext {
  zoneName: string;
  biomeType: string;
  mood: string;
  timeOfDay?: string;
  weather?: string;
}

export function buildMusicGenerationPrompt(context: MusicGenerationContext): string {
  const parts = [
    `Compose background music for this game zone:`,
    ``,
    `Zone: ${context.zoneName}`,
    `Biome: ${context.biomeType}`,
    `Mood: ${context.mood}`,
  ];

  if (context.timeOfDay) {
    parts.push(`Time of Day: ${context.timeOfDay}`);
  }

  if (context.weather) {
    parts.push(`Weather: ${context.weather}`);
  }

  parts.push(
    ``,
    `Create a short, looping chiptune track (2-8 measures) that captures the feeling of this place.`,
    `The music should loop seamlessly and feel appropriate for exploration in this environment.`,
  );

  return parts.join("\n");
}
