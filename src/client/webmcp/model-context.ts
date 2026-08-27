import {nativeWebMcpAvailable} from "./feature-detection";

export interface WebMcpExecutionOptions {
  signal: AbortSignal;
}

export interface WebMcpTool {
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  description: string;
  execute: (
    input: unknown,
    options: WebMcpExecutionOptions,
  ) => unknown | Promise<unknown>;
  inputSchema: Record<string, unknown>;
  name: string;
}

export interface WebMcpModelContext {
  registerTool: (
    tool: WebMcpTool,
    options?: {signal?: AbortSignal},
  ) => Promise<void>;
}

function modelContextFromDocument(
  currentDocument: Document,
): WebMcpModelContext | undefined {
  const value = Reflect.get(currentDocument, "modelContext") as unknown;
  if (!value || typeof value !== "object") return undefined;
  return typeof Reflect.get(value, "registerTool") === "function"
    ? value as WebMcpModelContext
    : undefined;
}

export function nativeModelContext(
  currentDocument: Document = document,
): WebMcpModelContext | undefined {
  return nativeWebMcpAvailable(currentDocument)
    ? modelContextFromDocument(currentDocument)
    : undefined;
}

export async function registerWebMcpTools(
  tools: WebMcpTool[],
  signal: AbortSignal,
): Promise<void> {
  const modelContext = nativeModelContext();
  if (!modelContext || signal.aborted) return;
  await Promise.all(tools.map((tool) =>
    modelContext.registerTool(tool, {signal})
  ));
}
