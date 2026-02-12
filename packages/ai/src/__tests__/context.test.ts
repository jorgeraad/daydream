import { describe, expect, it } from "bun:test";
import { ContextManager } from "../context.ts";

describe("ContextManager", () => {
  it("returns empty context blocks when nothing is set", () => {
    const cm = new ContextManager();
    const ctx = cm.getContextFor("dialogue");
    expect(ctx.worldContext).toBe("");
    expect(ctx.chronicleSummary).toBe("");
    expect(ctx.recentEvents).toBe("");
    expect(ctx.specificContext).toBe("");
  });

  it("returns set context values", () => {
    const cm = new ContextManager();
    cm.setWorldContext("A medieval kingdom");
    cm.setChronicleSummary("The hero arrived");
    cm.setRecentEvents("A storm brews");

    const ctx = cm.getContextFor("dialogue", "The blacksmith is angry");
    expect(ctx.worldContext).toBe("A medieval kingdom");
    expect(ctx.chronicleSummary).toBe("The hero arrived");
    expect(ctx.recentEvents).toBe("A storm brews");
    expect(ctx.specificContext).toBe("The blacksmith is angry");
  });

  it("truncates content that exceeds budget", () => {
    const cm = new ContextManager({ worldContext: 10 }); // 10 tokens ~= 40 chars
    const longText = "A".repeat(200);
    cm.setWorldContext(longText);

    // Use zone-generation which has no budget overrides for worldContext
    const ctx = cm.getContextFor("zone-generation");
    expect(ctx.worldContext.length).toBeLessThan(200);
    expect(ctx.worldContext).toContain("[...truncated]");
  });

  it("does not truncate content within budget", () => {
    const cm = new ContextManager({ worldContext: 1000 });
    const shortText = "A short world description";
    cm.setWorldContext(shortText);

    const ctx = cm.getContextFor("dialogue");
    expect(ctx.worldContext).toBe(shortText);
  });

  it("uses task-specific budget overrides", () => {
    const cm = new ContextManager();

    const worldCreationBudget = cm.getBudgetForTask("world-creation");
    expect(worldCreationBudget.systemPrompt).toBe(3000);
    expect(worldCreationBudget.chronicleSummary).toBe(0);

    const dialogueBudget = cm.getBudgetForTask("dialogue");
    expect(dialogueBudget.specificContext).toBe(3000);

    const defaultBudget = cm.getBudgetForTask("zone-generation");
    expect(defaultBudget.systemPrompt).toBe(2000);
  });

  it("assembles user message from context block", () => {
    const cm = new ContextManager();
    cm.setWorldContext("Medieval kingdom");
    cm.setChronicleSummary("The hero arrived at dawn");
    cm.setRecentEvents("Thunder rolls");

    const ctx = cm.getContextFor("dialogue", "The guard looks nervous");
    const message = cm.assembleUserMessage(ctx);

    expect(message).toContain("## World\nMedieval kingdom");
    expect(message).toContain("## Chronicle\nThe hero arrived at dawn");
    expect(message).toContain("## Recent Events\nThunder rolls");
    expect(message).toContain("## Context\nThe guard looks nervous");
  });

  it("omits empty sections from assembled message", () => {
    const cm = new ContextManager();
    cm.setWorldContext("Medieval kingdom");

    const ctx = cm.getContextFor("dialogue");
    const message = cm.assembleUserMessage(ctx);

    expect(message).toContain("## World\nMedieval kingdom");
    expect(message).not.toContain("## Chronicle");
    expect(message).not.toContain("## Recent Events");
    expect(message).not.toContain("## Context");
  });

  it("estimates current token usage", () => {
    const cm = new ContextManager();
    cm.setWorldContext("A".repeat(400)); // ~100 tokens
    cm.setChronicleSummary("B".repeat(200)); // ~50 tokens

    const usage = cm.estimateCurrentUsage();
    expect(usage.worldContext).toBe(100);
    expect(usage.chronicleSummary).toBe(50);
    expect(usage.recentEvents).toBe(0);
    expect(usage.total).toBe(150);
  });

  it("calculates total budget for a task", () => {
    const cm = new ContextManager();
    const total = cm.getTotalBudget("dialogue");
    // dialogue overrides: 2000 + 1000 + 1500 + 1000 + 3000 + 1500 = 10000
    expect(total).toBe(10000);
  });

  it("world-creation has zero chronicle budget", () => {
    const cm = new ContextManager();
    const longSummary = "Important history ".repeat(100);
    cm.setChronicleSummary(longSummary);

    const ctx = cm.getContextFor("world-creation");
    expect(ctx.chronicleSummary).toBe("");
  });

  describe("updateFromChronicle", () => {
    it("populates chronicle summary from both summaries", () => {
      const cm = new ContextManager();
      cm.updateFromChronicle(
        { recent: "The hero rested at the inn", historical: "Long ago, the kingdom fell" },
        "[event] A storm approaches",
      );

      const ctx = cm.getContextFor("dialogue");
      expect(ctx.chronicleSummary).toContain("Long ago, the kingdom fell");
      expect(ctx.chronicleSummary).toContain("The hero rested at the inn");
      expect(ctx.recentEvents).toBe("[event] A storm approaches");
    });

    it("handles empty historical summary", () => {
      const cm = new ContextManager();
      cm.updateFromChronicle(
        { recent: "Recent events only", historical: "" },
        "Some recent entries",
      );

      const ctx = cm.getContextFor("dialogue");
      expect(ctx.chronicleSummary).toBe("Recent events only");
    });

    it("handles both summaries empty", () => {
      const cm = new ContextManager();
      cm.updateFromChronicle({ recent: "", historical: "" }, "");

      const ctx = cm.getContextFor("dialogue");
      expect(ctx.chronicleSummary).toBe("");
      expect(ctx.recentEvents).toBe("");
    });

    it("chronicle-compression task gets full chronicle budget", () => {
      const cm = new ContextManager();
      const longSummary = "A".repeat(20000);
      cm.updateFromChronicle(
        { recent: longSummary, historical: "" },
        "B".repeat(10000),
      );

      const budget = cm.getBudgetForTask("chronicle-compression");
      expect(budget.chronicleSummary).toBe(3000);
      expect(budget.recentEvents).toBe(2000);

      const ctx = cm.getContextFor("chronicle-compression");
      // Should be truncated to fit within budget
      expect(ctx.chronicleSummary.length).toBeLessThan(longSummary.length);
    });

    it("dialogue uses character memory via specificContext", () => {
      const cm = new ContextManager();
      cm.updateFromChronicle(
        { recent: "The hero saved the village", historical: "" },
        "[conversation] Talked to the blacksmith",
      );

      const characterContext = "Trust: trusting (6), Familiarity: acquainted (3). Last interaction: Trade deal";
      const ctx = cm.getContextFor("dialogue", characterContext);

      expect(ctx.specificContext).toContain("Trust: trusting");
      expect(ctx.chronicleSummary).toContain("The hero saved the village");
      expect(ctx.recentEvents).toContain("Talked to the blacksmith");

      const message = cm.assembleUserMessage(ctx);
      expect(message).toContain("## Chronicle");
      expect(message).toContain("## Recent Events");
      expect(message).toContain("## Context");
      expect(message).toContain("Trust: trusting");
    });
  });
});
