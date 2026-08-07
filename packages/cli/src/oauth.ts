import {createHash, randomBytes} from "node:crypto";
import {createServer} from "node:http";
import {spawn} from "node:child_process";

import {
  CLI_CALLBACK_PORT,
  CLI_CALLBACK_URL,
  CLI_CLIENT_ID,
  REQUESTED_SCOPES,
} from "./constants.js";
import type {OAuthMetadata} from "./discovery.js";
import {CliError} from "./errors.js";
import type {TokenBundle} from "./store.js";

function randomBase64Url(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin"
    ? ["open", [url]] as const
    : process.platform === "win32"
    ? ["cmd", ["/c", "start", "", url]] as const
    : ["xdg-open", [url]] as const;
  const child = spawn(command[0], command[1], {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => undefined);
  child.unref();
}

export async function startOAuthCallback(
  expectedState: string,
): Promise<{code: Promise<string>}> {
  let finished = false;
  let timeout: NodeJS.Timeout | undefined;
  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: Error) => void;
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", CLI_CALLBACK_URL);
      if (url.pathname !== "/callback") {
        response.writeHead(404).end("Not found");
        return;
      }
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const oauthError = url.searchParams.get("error");
      if (state !== expectedState) {
        response.writeHead(400, {"content-type": "text/plain; charset=utf-8"}).end("State validation failed. Return to the terminal.");
        finish(new CliError("OAuth state validation failed."));
        return;
      }
      if (oauthError || !code) {
        response.writeHead(400, {"content-type": "text/plain; charset=utf-8"}).end("Authorization was denied. Return to the terminal.");
        finish(new CliError("Authorization was denied."));
        return;
      }
      response.writeHead(200, {"content-type": "text/html; charset=utf-8"}).end(
        "<!doctype html><title>microfeed login complete</title><p>Authorization complete. You can close this window.</p>",
      );
      finish(undefined, code);
  });
  const finish = (error?: Error, authorizationCode?: string) => {
    if (finished) return;
    finished = true;
    if (timeout) clearTimeout(timeout);
    if (server.listening) server.close();
    if (error) rejectCode(error);
    else resolveCode(authorizationCode!);
  };
  await new Promise<void>((resolve, reject) => {
    const onStartupError = (error: NodeJS.ErrnoException) => {
      const callbackError = new CliError(
        error.code === "EADDRINUSE"
          ? `Callback port ${CLI_CALLBACK_PORT} is already in use. Close the other process and run login again.`
          : `Unable to start the OAuth callback listener: ${error.message}`,
      );
      finished = true;
      reject(callbackError);
    };
    server.once("error", onStartupError);
    server.listen(CLI_CALLBACK_PORT, "127.0.0.1", () => {
      server.off("error", onStartupError);
      resolve();
    });
  });
  server.on("error", (error) => finish(new CliError(
    `The OAuth callback listener failed: ${error.message}`,
  )));
  timeout = setTimeout(() =>
    finish(new CliError("Browser authorization timed out. Run login again.")),
  5 * 60 * 1000);
  return {code};
}

async function exchangeToken(
  endpoint: string,
  parameters: URLSearchParams,
): Promise<TokenBundle> {
  const response = await fetch(endpoint, {
    body: parameters,
    headers: {accept: "application/json"},
    method: "POST",
    redirect: "manual",
  });
  if (!response.ok) {
    throw new CliError(`OAuth token exchange failed (${response.status}).`);
  }
  const value = await response.json() as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  };
  if (!value.access_token || value.token_type?.toLowerCase() !== "bearer") {
    throw new CliError("The OAuth token response was invalid.");
  }
  return {
    accessToken: value.access_token,
    expiresAt: Date.now() + Math.max(0, value.expires_in ?? 3600) * 1000,
    refreshToken: value.refresh_token,
    scope: value.scope ?? "",
    tokenType: "Bearer",
  };
}

export async function browserLogin(metadata: OAuthMetadata): Promise<TokenBundle> {
  const verifier = randomBase64Url(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBase64Url(32);
  const authorization = new URL(metadata.authorization_endpoint);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("client_id", CLI_CLIENT_ID);
  authorization.searchParams.set("redirect_uri", CLI_CALLBACK_URL);
  authorization.searchParams.set("scope", REQUESTED_SCOPES.join(" "));
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("code_challenge", challenge);
  authorization.searchParams.set("code_challenge_method", "S256");

  const callback = await startOAuthCallback(state);
  openBrowser(authorization.toString());
  process.stderr.write("Complete sign-in and approve permissions in your browser.\n");
  const code = await callback.code;
  return await exchangeToken(metadata.token_endpoint, new URLSearchParams({
    client_id: CLI_CLIENT_ID,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: CLI_CALLBACK_URL,
  }));
}

export async function refreshTokens(
  tokenEndpoint: string,
  refreshToken: string,
): Promise<TokenBundle> {
  return await exchangeToken(tokenEndpoint, new URLSearchParams({
    client_id: CLI_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }));
}

export async function revokeToken(
  issuer: string,
  token: string,
  hint: "access_token" | "refresh_token",
): Promise<void> {
  await fetch(`${issuer.replace(/\/$/u, "")}/oauth2/revoke`, {
    body: new URLSearchParams({
      client_id: CLI_CLIENT_ID,
      token,
      token_type_hint: hint,
    }),
    method: "POST",
    redirect: "manual",
  }).catch(() => undefined);
}
