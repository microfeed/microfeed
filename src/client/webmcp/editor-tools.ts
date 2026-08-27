import {
  registerWebMcpTools,
  type WebMcpTool,
  webMcpExecutionSignal,
} from "./model-context";
import {
  inputJsonSchema,
  parseInput,
  saveItemDraftInputSchema,
  savePageDraftInputSchema,
  type SaveItemDraftInput,
  type SavePageDraftInput,
} from "./schemas";

const writeAnnotations = {
  readOnlyHint: false,
  untrustedContentHint: true,
} as const;

export function itemDraftTool(
  save: (input: SaveItemDraftInput, signal: AbortSignal) => Promise<unknown>,
): WebMcpTool {
  return {
    annotations: writeAnnotations,
    description:
      "Merge title or body HTML into the visible new or unpublished microfeed Item and save it as an unpublished draft.",
    execute(input, options) {
      return save(
        parseInput(saveItemDraftInputSchema, input),
        webMcpExecutionSignal(options),
      );
    },
    inputSchema: inputJsonSchema(saveItemDraftInputSchema),
    name: "microfeed_save_item_draft",
  };
}

export function pageDraftTool(
  save: (input: SavePageDraftInput, signal: AbortSignal) => Promise<unknown>,
): WebMcpTool {
  return {
    annotations: writeAnnotations,
    description:
      "Merge supplied fields into the visible new or unpublished microfeed Page and save it as an unpublished draft.",
    execute(input, options) {
      return save(
        parseInput(savePageDraftInputSchema, input),
        webMcpExecutionSignal(options),
      );
    },
    inputSchema: inputJsonSchema(savePageDraftInputSchema),
    name: "microfeed_save_page_draft",
  };
}

export function registerItemDraftTool(
  signal: AbortSignal,
  save: (input: SaveItemDraftInput, signal: AbortSignal) => Promise<unknown>,
): Promise<void> {
  return registerWebMcpTools([itemDraftTool(save)], signal);
}

export function registerPageDraftTool(
  signal: AbortSignal,
  save: (input: SavePageDraftInput, signal: AbortSignal) => Promise<unknown>,
): Promise<void> {
  return registerWebMcpTools([pageDraftTool(save)], signal);
}
