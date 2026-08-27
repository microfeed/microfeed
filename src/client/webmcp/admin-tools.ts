import {ITEM_STATUSES_DICT} from "@/shared/Constants";
import {ADMIN_URLS} from "@/shared/StringUtils";
import {
  registerWebMcpTools,
  type WebMcpTool,
} from "./model-context";
import {
  emptyInputSchema,
  getItemInputSchema,
  getPageInputSchema,
  inputJsonSchema,
  listItemsInputSchema,
  parseInput,
  startDraftInputSchema,
} from "./schemas";

let dashboardController: AbortController | undefined;

const readAnnotations = {
  readOnlyHint: true,
  untrustedContentHint: true,
} as const;
const navigationAnnotations = {
  readOnlyHint: false,
  untrustedContentHint: false,
} as const;

async function responseJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    throw new Error(data.error ?? `microfeed request failed (${response.status}).`);
  }
  return data;
}

async function getJson(url: string, signal: AbortSignal): Promise<any> {
  return responseJson(await fetch(url, {
    credentials: "same-origin",
    headers: {accept: "application/json"},
    signal,
  }));
}

function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

function itemStatusName(value: unknown): string {
  return ITEM_STATUSES_DICT[
    Number(value) as keyof typeof ITEM_STATUSES_DICT
  ]?.name ?? "unknown";
}

export function dashboardTools(): WebMcpTool[] {
  return [
    {
      annotations: readAnnotations,
      description:
        "List compact microfeed Item summaries, optionally filtered by status and continued from a cursor.",
      async execute(input, {signal}) {
        const parsed = parseInput(listItemsInputSchema, input);
        const url = new URL(ADMIN_URLS.ajaxItems(), window.location.origin);
        if (parsed.status) url.searchParams.set("status", parsed.status);
        if (parsed.limit) url.searchParams.set("limit", String(parsed.limit));
        if (parsed.cursor) url.searchParams.set("next_cursor", parsed.cursor);
        const result = await getJson(url.toString(), signal);
        return {
          items: result.items.map((item: Record<string, unknown>) => ({
            id: item.id,
            status: itemStatusName(item.status),
            title: item.title,
            updated_at_ms: item.updatedAtMs,
            editor_url: absoluteUrl(ADMIN_URLS.editItem(item.id)),
          })),
          ...(result.nextCursor ? {next_cursor: result.nextCursor} : {}),
        };
      },
      inputSchema: inputJsonSchema(listItemsInputSchema),
      name: "microfeed_list_items",
    },
    {
      annotations: readAnnotations,
      description: "Get editable fields and status for one microfeed Item.",
      async execute(input, {signal}) {
        const {item_id: itemId} = parseInput(getItemInputSchema, input);
        const item = await getJson(
          `${ADMIN_URLS.ajaxItems()}${encodeURIComponent(itemId)}/`,
          signal,
        );
        return {
          ...item,
          status: itemStatusName(item.status),
          editor_url: absoluteUrl(ADMIN_URLS.editItem(itemId)),
        };
      },
      inputSchema: inputJsonSchema(getItemInputSchema),
      name: "microfeed_get_item",
    },
    {
      annotations: readAnnotations,
      description: "List compact microfeed Page summaries and editor URLs.",
      async execute(input, {signal}) {
        parseInput(emptyInputSchema, input);
        const result = await getJson(ADMIN_URLS.ajaxPages(), signal);
        return {
          items: result.items.map((page: Record<string, unknown>) => ({
            id: page.id,
            navigation_label: page.navigation_label,
            show_in_navigation: page.show_in_navigation,
            slug: page.slug,
            status: page.status,
            title: page.title,
            editor_url: absoluteUrl(ADMIN_URLS.editPage(String(page.id))),
          })),
        };
      },
      inputSchema: inputJsonSchema(emptyInputSchema),
      name: "microfeed_list_pages",
    },
    {
      annotations: readAnnotations,
      description: "Get editable fields and status for one microfeed Page.",
      async execute(input, {signal}) {
        const {page_id: pageId} = parseInput(getPageInputSchema, input);
        const page = await getJson(ADMIN_URLS.ajaxPage(pageId), signal);
        return {
          ...page,
          editor_url: absoluteUrl(ADMIN_URLS.editPage(pageId)),
        };
      },
      inputSchema: inputJsonSchema(getPageInputSchema),
      name: "microfeed_get_page",
    },
    {
      annotations: navigationAnnotations,
      description:
        "Open the new microfeed Item or Page editor without creating content.",
      execute(input) {
        const {kind} = parseInput(startDraftInputSchema, input);
        const path = kind === "item" ? ADMIN_URLS.newItem() : ADMIN_URLS.newPage();
        const editorUrl = absoluteUrl(path);
        setTimeout(() => window.location.assign(editorUrl), 0);
        return {editor_url: editorUrl, kind};
      },
      inputSchema: inputJsonSchema(startDraftInputSchema),
      name: "microfeed_start_draft",
    },
  ];
}

export async function reconcileAdminWebMcpTools(): Promise<void> {
  dashboardController?.abort();
  const controller = new AbortController();
  dashboardController = controller;
  try {
    await registerWebMcpTools(dashboardTools(), controller.signal);
  } catch (error) {
    if (dashboardController === controller) clearAdminWebMcpTools();
    throw error;
  }
}

export function clearAdminWebMcpTools(): void {
  dashboardController?.abort();
  dashboardController = undefined;
}
