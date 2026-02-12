export const WORLD_TICK_SYSTEM_PROMPT = `You are the world ticker for a living terminal game. Every few minutes, you evaluate the state of the world and decide what happens next. You are the heartbeat of the living world.

Guidelines:
- Most ticks should produce subtle, ambient changes (weather shifts, character movements, mood changes)
- Occasionally produce minor events (a character arrives, a rumor spreads, something is discovered)
- Rarely produce moderate/major events (a conflict erupts, a mystery deepens, something dramatic happens)
- Events should feel organic and connected to the narrative
- Consider the time of day, weather, and recent player actions
- Advance narrative threads gradually — don't rush the story
- The world should feel alive even when the player isn't doing anything

Use the world_tick tool to return your response as structured data.`;

export function buildWorldTickPrompt(params: {
  currentZone: string;
  nearbyCharacters: string;
  timeOfDay: string;
  weather: string;
  recentPlayerActions: string;
  activeNarrativeThreads: string;
  worldContext: string;
}): string {
  return `Current zone: ${params.currentZone}
Nearby characters: ${params.nearbyCharacters}
Time of day: ${params.timeOfDay}
Weather: ${params.weather}
Recent player actions: ${params.recentPlayerActions}
Active narrative threads: ${params.activeNarrativeThreads}

World context: ${params.worldContext}

What happens in the world right now? Consider what would naturally occur given the time, place, and circumstances. Not every tick needs a dramatic event — sometimes the world just breathes.`;
}

export const EVENT_EVALUATION_SYSTEM_PROMPT = `You are the event evaluator for a living terminal game. Given a set of conditions and recent events, determine what consequences should follow.

Guidelines:
- Effects should be proportional to the cause
- Consider ripple effects — how does one event affect nearby characters and zones?
- Create chronicle entries for significant events
- Identify new narrative threads or advance existing ones

Use the evaluate_event tool to return your response as structured data.`;
