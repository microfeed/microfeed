import type {APIRoute} from "astro";
import {env} from "cloudflare:workers";
import {z} from "zod";

import {createMicrofeedAuth} from "@/server/auth/better-auth";
import {
  listOAuthClients,
  listOAuthConsents,
} from "@/server/auth/oauth-admin";
import {OAUTH_SCOPES} from "@/shared/OAuth";

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  public: z.boolean(),
  redirectUris: z.array(z.url()).min(1).max(10),
  scopes: z.array(z.enum([
    OAUTH_SCOPES.READ,
    OAUTH_SCOPES.WRITE,
    OAUTH_SCOPES.OFFLINE,
  ])).min(1),
});

function ownerId(locals: App.Locals): string {
  if (!locals.authUser?.id) throw new Error("OAuth owner was not authenticated.");
  return locals.authUser.id;
}

export const GET: APIRoute = async ({locals}) => {
  const userId = ownerId(locals);
  const [clients, consents] = await Promise.all([
    listOAuthClients(env.FEED_DB, userId),
    listOAuthConsents(env.FEED_DB, userId),
  ]);
  return Response.json({clients, consents}, {
    headers: {"cache-control": "no-store"},
  });
};

export const POST: APIRoute = async ({locals, request}) => {
  ownerId(locals);
  const parsed = createClientSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({error: "Invalid OAuth application."}, {status: 400});
  }
  const invalidRedirect = parsed.data.redirectUris.find((redirect) => {
    const url = new URL(redirect);
    return url.protocol !== "https:" && !(
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    );
  });
  if (invalidRedirect) {
    return Response.json({
      error: "Redirect URLs must use HTTPS, except for loopback callbacks.",
    }, {status: 400});
  }

  const client = await createMicrofeedAuth(env, request).api.createOAuthClient({
    body: {
      client_name: parsed.data.name,
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: parsed.data.redirectUris,
      response_types: ["code"],
      scope: parsed.data.scopes.join(" "),
      token_endpoint_auth_method: parsed.data.public
        ? "none"
        : "client_secret_basic",
      type: parsed.data.public ? "native" : "web",
    },
    headers: request.headers,
  });
  return Response.json({client}, {
    headers: {"cache-control": "no-store", pragma: "no-cache"},
    status: 201,
  });
};
