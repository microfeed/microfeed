import type {APIRoute} from "astro";

import {
  API_LLMS_FULL_TEXT,
  API_LLMS_TEXT,
  OPENAPI_JSON,
  OPENAPI_YAML,
} from "@/server/openapi/document";
import {readApiAccessSettings} from "./api-keys";

export const getApiOpenApiJson: APIRoute = () =>
  new Response(OPENAPI_JSON, {
    headers: {"content-type": "application/json; charset=utf-8"},
  });

export const getApiOpenApiYaml: APIRoute = () =>
  new Response(OPENAPI_YAML, {
    headers: {"content-type": "application/yaml; charset=utf-8"},
  });

export const getApiLlms: APIRoute = () =>
  new Response(API_LLMS_TEXT, {
    headers: {"content-type": "text/plain; charset=utf-8"},
  });

export const getApiLlmsFull: APIRoute = () =>
  new Response(API_LLMS_FULL_TEXT, {
    headers: {"content-type": "text/plain; charset=utf-8"},
  });

export function redirectApiDocs(pathname: string): APIRoute {
  return ({url}) => {
    const destination = new URL(pathname, url);
    destination.search = url.search;
    return Response.redirect(destination, 308);
  };
}

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
