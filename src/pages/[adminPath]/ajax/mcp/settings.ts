import {env} from "cloudflare:workers";
import type {APIRoute} from "astro";
import {apiMcpSettingsSchema} from "@/shared/ApiSchemas";
import {updateMcpSettings} from "@/server/mcp/settings";

export const POST: APIRoute = async ({request}) => {
  const parsed = apiMcpSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({error: "Invalid MCP settings."}, {status: 400});
  try {
    return Response.json({settings: await updateMcpSettings(env, parsed.data)});
  } catch (error) {
    if (error instanceof TypeError) return Response.json({error: error.message}, {status: 409});
    throw error;
  }
};
