export const MICROFEED_OAUTH_CLIENT_ID = "microfeed-cli";
export const MICROFEED_OAUTH_CALLBACK_URL =
  "http://127.0.0.1:8977/callback";
export const OAUTH_AUTHORIZATION_SERVER_METADATA_PATH =
  "/.well-known/oauth-authorization-server/api/auth";

export const OAUTH_SCOPES = {
  READ: "content:read",
  WRITE: "content:write",
  OFFLINE: "offline_access",
} as const;

export const OAUTH_SCOPE_DESCRIPTIONS: Record<string, string> = {
  [OAUTH_SCOPES.READ]: "Read feeds and items",
  [OAUTH_SCOPES.WRITE]:
    "Create, update, and delete content and prepare media uploads",
  [OAUTH_SCOPES.OFFLINE]: "Stay signed in for up to 30 days",
};

export const OAUTH_ACCESS_TOKEN_PREFIX = "mf_oat_";
export const OAUTH_REFRESH_TOKEN_PREFIX = "mf_ort_";
export const OAUTH_CLIENT_SECRET_PREFIX = "mf_ocs_";

export const OAUTH_ACCESS_TOKEN_SECONDS = 60 * 60;
export const OAUTH_REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 30;

export interface OAuthClientSummary {
  clientId: string;
  createdAt: string | null;
  name: string;
  public: boolean;
  redirectUris: string[];
  scopes: string[];
}

export interface OAuthConsentSummary {
  clientId: string;
  clientName: string;
  createdAt: string;
  id: string;
  scopes: string[];
  updatedAt: string;
}
