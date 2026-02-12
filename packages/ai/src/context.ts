import {
  DEFAULT_CONTEXT_BUDGET,
  type ContextBlock,
  type ContextBudget,
  type TaskType,
} from "./types.ts";

// Rough estimate: 1 token ~= 4 characters
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function truncateToTokenBudget(text: string, tokenBudget: number): string {
  if (tokenBudget <= 0) return "";
  const charBudget = tokenBudget * CHARS_PER_TOKEN;
  if (text.length <= charBudget) return text;
  return text.slice(0, charBudget) + "\n[...truncated]";
}

const TASK_BUDGET_OVERRIDES: Partial<Record<TaskType, Partial<ContextBudget>>> =
  {
    "world-creation": {
      systemPrompt: 3000,
      worldContext: 500,
      chronicleSummary: 0,
      recentEvents: 0,
      specificContext: 1000,
      responseBudget: 4000,
    },
    "chronicle-compression": {
      systemPrompt: 1000,
      worldContext: 500,
      chronicleSummary: 3000,
      recentEvents: 2000,
      specificContext: 500,
      responseBudget: 1000,
    },
    dialogue: {
      systemPrompt: 2000,
      worldContext: 1000,
      chronicleSummary: 1500,
      recentEvents: 1000,
      specificContext: 3000,
      responseBudget: 1500,
    },
  };

export class ContextManager {
  private worldContext: string = "";
  private chronicleSummary: string = "";
  private recentEvents: string = "";
  private budget: ContextBudget;

  constructor(budget?: Partial<ContextBudget>) {
    this.budget = { ...DEFAULT_CONTEXT_BUDGET, ...budget };
  }

  setWorldContext(context: string): void {
    this.worldContext = context;
  }

  setChronicleSummary(summary: string): void {
    this.chronicleSummary = summary;
  }

  setRecentEvents(events: string): void {
    this.recentEvents = events;
  }

  /**
   * Convenience method to update both chronicle summary and recent events
   * from pre-formatted chronicle data. The game loop calls this to refresh
   * the AI context from the Chronicle store.
   */
  updateFromChronicle(summaries: { recent: string; historical: string }, recentEntries: string): void {
    const combined = [summaries.historical, summaries.recent]
      .filter(Boolean)
      .join("\n\n");
    this.chronicleSummary = combined;
    this.recentEvents = recentEntries;
  }

  getBudgetForTask(task: TaskType): ContextBudget {
    const overrides = TASK_BUDGET_OVERRIDES[task];
    if (!overrides) return { ...this.budget };
    return { ...this.budget, ...overrides };
  }

  getContextFor(
    task: TaskType,
    specificContext: string = "",
  ): ContextBlock {
    const budget = this.getBudgetForTask(task);

    return {
      system: "", // System prompt is set per-task by the caller
      worldContext: truncateToTokenBudget(this.worldContext, budget.worldContext),
      chronicleSummary: truncateToTokenBudget(
        this.chronicleSummary,
        budget.chronicleSummary,
      ),
      recentEvents: truncateToTokenBudget(
        this.recentEvents,
        budget.recentEvents,
      ),
      specificContext: truncateToTokenBudget(
        specificContext,
        budget.specificContext,
      ),
    };
  }

  assembleUserMessage(context: ContextBlock): string {
    const parts: string[] = [];

    if (context.worldContext) {
      parts.push(`## World\n${context.worldContext}`);
    }
    if (context.chronicleSummary) {
      parts.push(`## Chronicle\n${context.chronicleSummary}`);
    }
    if (context.recentEvents) {
      parts.push(`## Recent Events\n${context.recentEvents}`);
    }
    if (context.specificContext) {
      parts.push(`## Context\n${context.specificContext}`);
    }

    return parts.join("\n\n");
  }

  getTotalBudget(task: TaskType): number {
    const budget = this.getBudgetForTask(task);
    return (
      budget.systemPrompt +
      budget.worldContext +
      budget.chronicleSummary +
      budget.recentEvents +
      budget.specificContext +
      budget.responseBudget
    );
  }

  estimateCurrentUsage(): {
    worldContext: number;
    chronicleSummary: number;
    recentEvents: number;
    total: number;
  } {
    const wc = estimateTokens(this.worldContext);
    const cs = estimateTokens(this.chronicleSummary);
    const re = estimateTokens(this.recentEvents);
    return {
      worldContext: wc,
      chronicleSummary: cs,
      recentEvents: re,
      total: wc + cs + re,
    };
  }
}
