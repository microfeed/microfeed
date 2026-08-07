export const ADMIN_ACCOUNT_SECTIONS = [
  {icon: "identity", id: "login-identity", name: "Login & identity"},
  {icon: "passkey", id: "passkeys", name: "Passkeys"},
  {icon: "sessions", id: "active-sessions", name: "Active sessions"},
  {icon: "apps", id: "app-access", name: "App access"},
] as const;

export type AdminAccountSection = typeof ADMIN_ACCOUNT_SECTIONS[number];

export function filterAdminAccountSections(
  query: string,
): readonly AdminAccountSection[] {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized
    ? ADMIN_ACCOUNT_SECTIONS.filter((section) =>
        section.name.toLocaleLowerCase().includes(normalized)
      )
    : ADMIN_ACCOUNT_SECTIONS;
}
