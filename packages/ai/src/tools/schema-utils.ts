import { z, type ZodError } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool, ToolUseBlock } from "../types.ts";

/**
 * Create an Anthropic Tool definition from a Zod schema.
 * Derives JSON Schema from the Zod schema so the two stay in sync.
 */
export function createToolDef(
  name: string,
  description: string,
  schema: z.ZodObject<z.ZodRawShape>,
): Tool {
  const raw = zodToJsonSchema(schema, { $refStrategy: "none" });
  const { $schema: _, ...inputSchema } = raw as Record<string, unknown>;
  return {
    name,
    description,
    input_schema: inputSchema as Tool["input_schema"],
  };
}

/**
 * Validate a tool_use block against a Zod schema.
 * Checks tool name, validates input, and formats errors clearly.
 */
export function validateToolResponse<I, O>(
  toolUse: ToolUseBlock,
  expectedTool: string,
  schema: z.ZodType<O, z.ZodTypeDef, I>,
): O {
  if (toolUse.name !== expectedTool) {
    throw new Error(`Expected ${expectedTool} tool, got ${toolUse.name}`);
  }
  const result = schema.safeParse(toolUse.input);
  if (!result.success) {
    throw new Error(
      `Invalid ${expectedTool} response:\n${formatZodError(result.error)}`,
    );
  }
  return result.data;
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `  ${path}: ${issue.message}`;
    })
    .join("\n");
}
