export const CLI_CLIENT_ID = "microfeed-cli";
export const CLI_CALLBACK_URL = "http://127.0.0.1:8977/callback";
export const CLI_CALLBACK_PORT = 8977;
export const REQUESTED_SCOPES = [
  "content:read",
  "content:write",
  "offline_access",
] as const;
export const API_PATH_PREFIX = "/api/v1/";
