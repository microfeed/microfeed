import {describe, expect, it} from "vitest";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";

describe("integration authentication contracts", () => {
  it("keeps REST API-key authentication separate from MCP OAuth tokens", () => {
    for (const path of Object.values(OPENAPI_DOCUMENT.paths ?? {})) {
      for (const [method, value] of Object.entries(path)) {
        if (!["get", "post", "put", "delete"].includes(method) || !value || typeof value !== "object" || !("operationId" in value)) continue;
        if (value.tags?.includes("MCP") || value.security?.length === 0) continue;
        expect(value.security).toEqual([{bearerAuth: []}]);
      }
    }
    expect(OPENAPI_DOCUMENT.paths?.["/mcp/"]?.post?.security).toEqual([{mcpOAuthBearer: []}]);
    expect(OPENAPI_DOCUMENT.components?.securitySchemes?.bearerAuth).toMatchObject({type: "http", scheme: "bearer"});
    expect(OPENAPI_DOCUMENT.components?.securitySchemes?.mcpOAuthBearer).toMatchObject({type: "http", scheme: "bearer"});
  });
});
