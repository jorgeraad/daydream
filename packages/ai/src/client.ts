import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL_IDS,
  TASK_MODEL_MAP,
  type AIResponse,
  type GenerateParams,
  type ModelTier,
  type TaskType,
  type ToolUseBlock,
} from "./types.ts";

export class AIClient {
  private client: Anthropic;
  private defaultModel: ModelTier;

  constructor(options?: { apiKey?: string; defaultModel?: ModelTier }) {
    const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing API key. Set the ANTHROPIC_API_KEY environment variable or pass apiKey to AIClient.",
      );
    }
    this.client = new Anthropic({ apiKey });
    this.defaultModel = options?.defaultModel ?? "sonnet";
  }

  getModelForTask(task: TaskType): string {
    return MODEL_IDS[TASK_MODEL_MAP[task]];
  }

  async generate(params: GenerateParams): Promise<AIResponse> {
    const modelTier = params.model ?? this.defaultModel;
    const modelId = MODEL_IDS[modelTier];

    const response = await this.client.messages.create({
      model: modelId,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.7,
      system: params.system,
      messages: params.messages,
      ...(params.tools && params.tools.length > 0 ? { tools: params.tools } : {}),
    });

    return this.parseResponse(response);
  }

  async *stream(params: GenerateParams): AsyncGenerator<string> {
    const modelTier = params.model ?? this.defaultModel;
    const modelId = MODEL_IDS[modelTier];

    const stream = this.client.messages.stream({
      model: modelId,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.7,
      system: params.system,
      messages: params.messages,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  private parseResponse(response: Anthropic.Message): AIResponse {
    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolBlocks = response.content.filter(
      (b) => b.type === "tool_use",
    ) as ToolUseBlock[];

    return {
      text: textBlocks.map((b) => b.text).join(""),
      toolUse: toolBlocks,
      stopReason: response.stop_reason ?? "end_turn",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
