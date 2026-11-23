import {builtInAdminAuthEnabled} from "@/shared/AdminAuth";
import {normalizeAdminPath} from "@/shared/AdminPath";
import {STATUSES} from "@/shared/Constants";
import type {McpSettings} from "@/shared/Mcp";

export async function readMcpSettings(database: D1Database): Promise<McpSettings> {
  const row = await database.prepare(
    "SELECT data FROM settings WHERE category = 'mcpSettings' LIMIT 1",
  ).first<{data: string}>();
  try {
    return {enabled: row ? JSON.parse(row.data)?.enabled === true : false};
  } catch {
    return {enabled: false};
  }
}

export async function mcpAvailable(runtimeEnv: Env): Promise<boolean> {
  return builtInAdminAuthEnabled(runtimeEnv.MICROFEED_ADMIN_AUTH_MODE) &&
    (await readMcpSettings(runtimeEnv.FEED_DB)).enabled;
}

export async function mcpEnablementError(runtimeEnv: Env): Promise<string | null> {
  if (!builtInAdminAuthEnabled(runtimeEnv.MICROFEED_ADMIN_AUTH_MODE)) {
    return "Enable built-in administrator sign-in before enabling the MCP server.";
  }
  if (normalizeAdminPath(runtimeEnv.MICROFEED_ADMIN_PATH) === "mcp") {
    return "Change the existing mcp administrator path before enabling the MCP server.";
  }
  const page = await runtimeEnv.FEED_DB.prepare(
    "SELECT id FROM pages WHERE slug = 'mcp' AND status != ? LIMIT 1",
  ).bind(STATUSES.DELETED).first();
  return page ? "Rename the existing Page with the mcp URL before enabling the MCP server." : null;
}

export async function updateMcpSettings(runtimeEnv: Env, settings: McpSettings): Promise<McpSettings> {
  if (settings.enabled) {
    const error = await mcpEnablementError(runtimeEnv);
    if (error) throw new TypeError(error);
  }
  await runtimeEnv.FEED_DB.prepare(
    "INSERT INTO settings (category, data, created_at, updated_at) " +
    "VALUES ('mcpSettings', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
    "ON CONFLICT(category) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP",
  ).bind(JSON.stringify(settings)).run();
  return settings;
}
