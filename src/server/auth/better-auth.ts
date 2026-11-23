import {oauthProvider} from "@better-auth/oauth-provider";
import {passkey} from "@better-auth/passkey";
import {betterAuth} from "better-auth";
import {admin} from "better-auth/plugins";
import {mcpResource} from "@/shared/Mcp";
import {oauthBody, validateTokenResource, type OAuthResourceBinding} from "./oauth-resource";

import {oauthConnectionHandoff} from "@/server/auth/account-security";
import {adminUrl, normalizeAdminPath} from "@/shared/AdminPath";
import {
  MICROFEED_OAUTH_CLIENT_ID,
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_ACCESS_TOKEN_SECONDS,
  OAUTH_CLIENT_SECRET_PREFIX,
  OAUTH_REFRESH_TOKEN_PREFIX,
  OAUTH_REFRESH_TOKEN_SECONDS,
  OAUTH_SCOPES,
} from "@/shared/OAuth";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function createMicrofeedAuth(
  runtimeEnv: Env,
  request: Request,
  options: {mcpEnabled?: boolean; resourceBinding?: OAuthResourceBinding} = {},
) {
  const url = new URL(request.url);
  const origin = url.origin;
  const tokenBody = url.pathname === "/api/auth/oauth2/token"
    ? oauthBody(request.clone()) : Promise.resolve({});
  const authorizationParameters = request.method === "POST" && url.pathname.startsWith("/api/auth/") && url.pathname !== "/api/auth/oauth2/token"
    ? oauthBody(request.clone()).then(body => typeof body.oauth_query === "string" ? new URLSearchParams(body.oauth_query) : url.searchParams)
    : Promise.resolve(url.searchParams);
  const oauthClientId = authorizationParameters.then(params => params.get("client_id"));
  const adminPath = normalizeAdminPath(runtimeEnv.MICROFEED_ADMIN_PATH);
  return betterAuth({
    account: {
      modelName: "auth_account",
    },
    advanced: {
      cookiePrefix: "microfeed",
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      useSecureCookies: new URL(request.url).protocol === "https:",
    },
    basePath: "/api/auth",
    baseURL: origin,
    database: runtimeEnv.FEED_DB,
    disabledPaths: [
      "/oauth2/create-client",
      "/oauth2/delete-client",
      "/oauth2/update-client",
      "/oauth2/client/rotate-secret",
    ],
    emailAndPassword: {
      disableSignUp: true,
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
    },
    plugins: [
      admin(),
      passkey({
        origin,
        rpID: new URL(origin).hostname,
        rpName: "microfeed",
        schema: {
          passkey: {modelName: "passkey"},
        },
      }),
      oauthProvider({
        accessTokenExpiresIn: OAUTH_ACCESS_TOKEN_SECONDS,
        allowDynamicClientRegistration: options.mcpEnabled === true,
        allowUnauthenticatedClientRegistration: options.mcpEnabled === true,
        cachedTrustedClients: new Set([MICROFEED_OAUTH_CLIENT_ID]),
        clientPrivileges: () => true,
        clientRegistrationAllowedScopes: [
          OAUTH_SCOPES.READ,
          OAUTH_SCOPES.WRITE,
          OAUTH_SCOPES.OFFLINE,
        ],
        clientRegistrationDefaultScopes: [OAUTH_SCOPES.READ],
        consentPage: adminUrl("api/oauth/consent", adminPath),
        disableJwtPlugin: true,
        // Resolve the resource-bearing query after the provider validates known fields.
        requestUriResolver: async ({requestUri, ctx}) => {
          const original = await authorizationParameters;
          const resource = original.get("resource");
          if (resource === null || requestUri !== "urn:microfeed:resource-authorization") return null;
          return {...ctx.query, request_uri: requestUri, resource,
            client_id: original.get("client_id") ?? "",
            redirect_uri: original.get("redirect_uri") ?? "",
          };
        },
        customTokenResponseFields: async info => {
          await validateTokenResource(runtimeEnv.FEED_DB, request, await tokenBody, info.grantType, (info.verificationValue?.query as {resource?: unknown} | undefined)?.resource, options.mcpEnabled === true, options.resourceBinding ?? {});
          return {};
        },
        grantTypes: ["authorization_code", "refresh_token"],
        loginPage: adminUrl("login", adminPath),
        prefix: {
          clientSecret: OAUTH_CLIENT_SECRET_PREFIX,
          opaqueAccessToken: OAUTH_ACCESS_TOKEN_PREFIX,
          refreshToken: OAUTH_REFRESH_TOKEN_PREFIX,
        },
        postLogin: {
          consentReferenceId: async () =>
            await oauthClientId === MICROFEED_OAUTH_CLIENT_ID
              ? (await oauthConnectionHandoff(request, runtimeEnv.BETTER_AUTH_SECRET))?.connectionId
              : undefined,
          page: adminUrl("api/oauth/consent", adminPath),
          shouldRedirect: () => false,
        },
        refreshTokenExpiresIn: OAUTH_REFRESH_TOKEN_SECONDS,
        schema: {
          oauthAccessToken: {modelName: "oauth_access_token"},
          oauthClient: {modelName: "oauth_client"},
          oauthConsent: {modelName: "oauth_consent"},
          oauthRefreshToken: {modelName: "oauth_refresh_token"},
        },
        scopes: [
          OAUTH_SCOPES.READ,
          OAUTH_SCOPES.WRITE,
          OAUTH_SCOPES.OFFLINE,
        ],
        silenceWarnings: {oauthAuthServerConfig: true},
        storeTokens: "hashed",
        validAudiences: options.mcpEnabled ? [origin, mcpResource(origin), `${origin}/mcp`] : [origin],
      }),
    ],
    rateLimit: {
      customRules: {
        "/oauth2/register": {max: 5, window: 60},
        "/sign-in/email": {
          max: 5,
          window: 60,
        },
        "/verify-password": {
          max: 5,
          window: 60,
        },
      },
      enabled: true,
      max: 100,
      modelName: "auth_rate_limit",
      storage: "database",
      window: 60,
    },
    secret: runtimeEnv.BETTER_AUTH_SECRET,
    session: {
      expiresIn: THIRTY_DAYS,
      modelName: "auth_session",
      updateAge: 60 * 60 * 24,
    },
    user: {
      modelName: "auth_user",
    },
    verification: {
      modelName: "auth_verification",
    },
    trustedOrigins: [origin],
  });
}

export function withAuthSessionCookies(
  response: Response,
  authHeaders: Headers,
): Response {
  const cookies = authHeaders.getSetCookie();
  if (cookies.length === 0) {
    return response;
  }

  const headers = new Headers(response.headers);
  cookies.forEach((cookie) => headers.append("set-cookie", cookie));
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export type MicrofeedAuth = ReturnType<typeof createMicrofeedAuth>;
