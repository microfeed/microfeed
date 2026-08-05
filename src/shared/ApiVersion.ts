export const API_MAJOR_VERSION = 1;
export const API_VERSION = `v${API_MAJOR_VERSION}` as const;
export const API_BASE_PATH = `/api/${API_VERSION}/` as const;
export const LEGACY_API_BASE_PATH = "/api/";

export const LEGACY_API_DEPRECATION = "@1785888000";
