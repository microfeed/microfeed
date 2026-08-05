import {readApiAccessSettings} from "./api-keys";

export async function legacyApiReferenceRedirect(
  database: D1Database,
  url: URL,
  pathname: string,
): Promise<Response> {
  const settings = await readApiAccessSettings(database);
  if (!settings.enabled || !settings.publicDocsEnabled) {
    return new Response("404", {
      headers: {"content-type": "text/plain; charset=utf-8"},
      status: 404,
    });
  }
  return Response.redirect(new URL(pathname, url), 308);
}
