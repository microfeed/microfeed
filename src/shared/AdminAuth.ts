export type AdminAuthMode = "built-in" | "none";

export function normalizeAdminAuthMode(
  value?: string | null,
): AdminAuthMode {
  return value === "none" ? "none" : "built-in";
}

export function builtInAdminAuthEnabled(
  value?: string | null,
): boolean {
  return normalizeAdminAuthMode(value) === "built-in";
}
