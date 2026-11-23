import type {APIRoute} from "astro";
import {jsonResponse} from "@/server/http";
import type {WebhookOrigin} from "@/server/webhooks/events";

export interface ContentOperationContext {
  locals: Pick<App.Locals, "feedDb" | "feedCrud" | "publicBucketUrl">;
  params: Record<string, string | undefined>;
  input?: unknown;
  query: URLSearchParams;
  request: Request;
  origin: WebhookOrigin;
  idempotencyKey?: string | null;
}

export interface ContentResult {
  data: unknown;
  status: number;
  headers?: HeadersInit;
  rawBody?: string;
}

export type ContentOperation = (context: ContentOperationContext) => ContentResult | Promise<ContentResult>;

export function contentResult(data: unknown, init: ResponseInit = {}): ContentResult {
  return {data, status: init.status ?? 200, headers: init.headers};
}

// Public feed renderers also serve non-JSON errors and onboarding redirects.
export async function feedResult(response: Response): Promise<ContentResult> {
  const body = await response.text();
  const isJson = response.headers.get("content-type")?.includes("json");
  return {
    data: isJson ? JSON.parse(body) : {error: body || "Content not found."},
    ...(isJson ? {} : {rawBody: body}),
    status: response.status,
    headers: response.headers,
  };
}

export function contentApiRoute(operation: ContentOperation): APIRoute {
  return async ({locals, params, request}) => {
    const result = await operation({
      locals, params, request,
      query: new URL(request.url).searchParams,
      input: ["POST", "PUT", "PATCH"].includes(request.method)
        ? await request.json().catch(() => null) : undefined,
      origin: "api",
      idempotencyKey: request.headers.get("idempotency-key"),
    });
    const init = {status: result.status, headers: result.headers};
    return result.rawBody === undefined
      ? jsonResponse(result.data, init)
      : new Response(result.rawBody, init);
  };
}
