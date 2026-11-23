import {cache} from "cloudflare:workers";
import {McpServer, WebStandardStreamableHTTPServerTransport, requireScopes} from "@modelcontextprotocol/server";
import {createFeedCrud, loadFeed} from "@/server/feed/feed";
import {verifyOAuthAccessToken} from "@/server/auth/oauth-access";
import {mcpAvailable} from "./settings";
import {MCP_TOOLS} from "./tools";
import {MCP_RESOURCE_METADATA_PATH, mcpResource} from "@/shared/Mcp";
import {MICROFEED_VERSION} from "@/shared/Version";
import {OAUTH_SCOPES} from "@/shared/OAuth";
import {apiMcpResourceMetadataSchema, apiWebhookContextHeadersSchema} from "@/shared/ApiSchemas";
import {resolvePublicBucketUrl} from "@/shared/StringUtils";
import type {ContentOperationContext} from "@/server/content/operation";

export async function mcpMetadataResponse(runtimeEnv: Env, request: Request): Promise<Response> {
  if (!await mcpAvailable(runtimeEnv)) return new Response("404", {status: 404});
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, {status: 405, headers: {allow: "GET, HEAD"}});
  const origin = new URL(request.url).origin;
  const metadata = apiMcpResourceMetadataSchema.parse({
    resource: mcpResource(origin),
    resource_name: "microfeed MCP server",
    authorization_servers: [`${origin}/api/auth`],
    bearer_methods_supported: ["header"],
    scopes_supported: [OAUTH_SCOPES.READ, OAUTH_SCOPES.WRITE],
  });
  return new Response(request.method === "HEAD" ? null : JSON.stringify(metadata), {
    headers: {"content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*"},
  });
}

export async function mcpResponse(runtimeEnv: Env, request: Request): Promise<Response> {
  if (!await mcpAvailable(runtimeEnv)) return new Response("404", {status: 404});
  const origin = new URL(request.url).origin;
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin !== null && requestOrigin !== origin) return new Response("Forbidden", {status: 403});
  const automationContext = apiWebhookContextHeadersSchema.safeParse({
    "Microfeed-Causation-Id": request.headers.get("Microfeed-Causation-Id") ?? undefined,
    "Microfeed-Correlation-Id": request.headers.get("Microfeed-Correlation-Id") ?? undefined,
  });
  if (!automationContext.success) return Response.json({error: "Invalid microfeed automation context header."}, {status: 400});
  const metadataUrl = new URL(MCP_RESOURCE_METADATA_PATH, origin).href;
  const credential = /^Bearer\s+(\S+)$/iu.exec(request.headers.get("authorization") ?? "")?.[1];
  const grant = credential ? await verifyOAuthAccessToken(runtimeEnv.FEED_DB, credential, mcpResource(origin), false) : null;
  if (!grant) return new Response("Unauthorized", {
    status: 401,
    headers: {"www-authenticate": `Bearer resource_metadata="${metadataUrl}", scope="content:read"`},
  });
  if (![OAUTH_SCOPES.READ, OAUTH_SCOPES.WRITE].some(scope => grant.scopes.has(scope))) {
    return new Response("Forbidden", {status: 403, headers: {"www-authenticate": `Bearer error="insufficient_scope", resource_metadata="${metadataUrl}", scope="content:read"`}});
  }
  const server = new McpServer({name: "microfeed", version: MICROFEED_VERSION}, {
    instructions: "Manage this microfeed instance. Mutations use the same publishing defaults as the API. Prepare media uploads, upload the bytes using HTTP PUT, then use media_url in content.",
  });
  for (const tool of MCP_TOOLS) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.schema,
      annotations: {readOnlyHint: tool.readOnly, destructiveHint: tool.destructive, openWorldHint: false},
      scopeChallenge: requireScopes(tool.scope),
    }, async (args: Record<string, unknown>) => {
      const query = new URLSearchParams();
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(args)) {
        if (["input", "idempotencyKey", "automationContext"].includes(key) || value === undefined) continue;
        query.set(key, String(value));
        params[key] = String(value);
      }
      const headers = new Headers(request.headers);
      if (args.automationContext && typeof args.automationContext === "object") {
        for (const [key, value] of Object.entries(args.automationContext)) {
          if (typeof value === "string") headers.set(key, value);
        }
      }
      // Carry HTTP origin and automation context, without dispatching an HTTP API call.
      const operationRequest = new Request(request.url, {headers, method: request.method});
      const loaded = await loadFeed(runtimeEnv, operationRequest, {includeItems: false}, cache);
      const context: ContentOperationContext = {
        request: operationRequest, params, query, input: args.input,
        origin: "mcp",
        idempotencyKey: typeof args.idempotencyKey === "string" ? args.idempotencyKey : undefined,
        locals: {
          feedDb: loaded.database,
          feedCrud: createFeedCrud(loaded.content, loaded.database, operationRequest),
          publicBucketUrl: resolvePublicBucketUrl(loaded.content.settings?.webGlobalSettings?.publicBucketUrl, new URL(request.url).hostname),
        },
      };
      const result = await tool.operation(context);
      const data = result.data && typeof result.data === "object" && !Array.isArray(result.data)
        ? result.data as Record<string, unknown> : {result: result.data};
      return {content: [{type: "text" as const, text: JSON.stringify(data)}], structuredContent: data, ...(result.status >= 300 ? {isError: true} : {})};
    });
  }
  const transport = new WebStandardStreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true});
  await server.connect(transport);
  return transport.handleRequest(request, {authInfo: {
    token: credential!, clientId: grant.clientId, scopes: [...grant.scopes],
    resource: new URL(mcpResource(origin)), resourceMetadataUrl: metadataUrl,
  }});
}
