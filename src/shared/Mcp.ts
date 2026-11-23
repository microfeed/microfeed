export const MCP_PATH = "/mcp/";
export const MCP_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";

export interface McpSettings {
  enabled: boolean;
}

export function isMcpPath(pathname: string): boolean {
  return pathname === "/mcp" || pathname === MCP_PATH;
}

export function isMcpMetadataPath(pathname: string): boolean {
  return pathname === MCP_RESOURCE_METADATA_PATH ||
    pathname === `${MCP_RESOURCE_METADATA_PATH}/` ||
    pathname === `${MCP_RESOURCE_METADATA_PATH}/mcp` ||
    pathname === `${MCP_RESOURCE_METADATA_PATH}/mcp/`;
}

export function mcpResource(origin: string): string {
  return new URL(MCP_PATH, origin).href;
}
