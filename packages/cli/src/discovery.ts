import {CliError} from "./errors.js";

interface MicrofeedIdentity {
  instanceId: string;
  oauthAuthorizationAvailable?: boolean;
  product: string;
}

export interface OAuthMetadata {
  authorization_endpoint: string;
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
  issuer: string;
  token_endpoint: string;
}

export function normalizeOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CliError("Provide a complete microfeed site URL, such as https://feed.example.com.");
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new CliError("microfeed login requires HTTPS, except for local loopback instances.");
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new CliError("The site URL must not contain a path, query, credentials, or fragment.");
  }
  return url.origin;
}

async function sameOriginJson<T>(url: URL, origin: string): Promise<T> {
  const response = await fetch(url, {
    headers: {accept: "application/json"},
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    throw new CliError(`The instance redirected ${url.pathname}; cross-origin discovery is not allowed.`);
  }
  if (!response.ok) throw new CliError(`The instance did not provide ${url.pathname} (${response.status}).`);
  if (new URL(response.url).origin !== origin) {
    throw new CliError("The instance returned discovery data from a different site.");
  }
  return await response.json() as T;
}

export async function discoverInstance(originInput: string): Promise<{
  identity: MicrofeedIdentity;
  metadata: OAuthMetadata;
  origin: string;
}> {
  const origin = normalizeOrigin(originInput);
  const identity = await sameOriginJson<MicrofeedIdentity>(
    new URL("/.well-known/microfeed.json", origin),
    origin,
  );
  if (identity.product !== "microfeed" || !identity.instanceId?.trim()) {
    throw new CliError("The target does not identify itself as a microfeed instance.");
  }
  if (identity.oauthAuthorizationAvailable === false) {
    throw new CliError(
      "Browser authorization is unavailable because this microfeed site has " +
      "built-in login disabled. Cloudflare Access can protect dashboard " +
      "routes, but it does not create the microfeed application session " +
      "required for OAuth. The site owner can enable built-in login with " +
      "`npx @microfeed/cli manage auth setup`, then retry. Guide: " +
      "https://docs.microfeed.org/manage/domains-and-access/#enable-built-in-login",
    );
  }
  let metadata: OAuthMetadata;
  try {
    metadata = await sameOriginJson<OAuthMetadata>(
      new URL("/.well-known/oauth-authorization-server/api/auth", origin),
      origin,
    );
  } catch (error) {
    if (error instanceof CliError && error.message.endsWith("(404).")) {
      throw new CliError(
        "The site did not provide OAuth discovery metadata. Built-in login " +
        "may be disabled, or this microfeed version may not support browser " +
        "authorization. Cloudflare Access alone does not create a microfeed " +
        "application session. The site owner can run " +
        "`npx @microfeed/cli manage auth setup`, then retry. Guide: " +
        "https://docs.microfeed.org/manage/domains-and-access/#enable-built-in-login",
      );
    }
    throw error;
  }
  const issuer = new URL(metadata.issuer);
  const authorizationEndpoint = new URL(metadata.authorization_endpoint);
  const tokenEndpoint = new URL(metadata.token_endpoint);
  if ([issuer, authorizationEndpoint, tokenEndpoint].some((url) =>
    url.origin !== origin
  )) {
    throw new CliError("The authorization service must use the same site URL.");
  }
  if (!metadata.code_challenge_methods_supported?.includes("S256")) {
    throw new CliError("This instance does not advertise mandatory S256 PKCE.");
  }
  if (!metadata.grant_types_supported?.includes("authorization_code")) {
    throw new CliError("This instance does not support browser authorization.");
  }
  return {identity, metadata, origin};
}
