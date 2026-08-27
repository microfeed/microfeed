import {escapeHtml} from "@/shared/StringUtils";
import {managementCommand} from "@/shared/ManagementCli";

export interface AdminOwner {
  email: string;
  id: string;
}

export const ADMIN_DASHBOARD_LOGIN_HELP_URL =
  "https://github.com/microfeed/microfeed#manage-the-dashboard-login";

const ADMIN_DASHBOARD_LOCKED_MESSAGE =
  "The admin dashboard is locked until its owner creates a password.";

interface AdminDashboardLockedOptions {
  instanceName?: string;
  local?: boolean;
}

function dashboardAuthCommand(
  action: "disable" | "setup",
  instanceName?: string,
): string {
  const normalizedInstanceName = instanceName?.trim();
  const instanceOption = normalizedInstanceName &&
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(normalizedInstanceName)
    ? ` --instance ${normalizedInstanceName}`
    : "";
  return managementCommand(`auth ${action}${instanceOption}`);
}

export async function adminOwner(
  database: D1Database,
): Promise<AdminOwner | undefined> {
  const owner = await database.prepare(
    'SELECT "id", "email" FROM "auth_user" ORDER BY "createdAt" LIMIT 1',
  ).first<AdminOwner>();
  return owner ?? undefined;
}

export async function hasAdminOwner(
  database: D1Database,
): Promise<boolean> {
  return Boolean(await adminOwner(database));
}

export function adminDashboardLockedResponse(
  html = true,
  options: AdminDashboardLockedOptions = {},
): Response {
  const setupCommand = dashboardAuthCommand("setup", options.instanceName);
  const disableCommand = options.local
    ? dashboardAuthCommand("disable", options.instanceName)
    : undefined;
  const body = html
    ? `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin dashboard locked</title>
  </head>
  <body>
    <main>
      <h1>Admin dashboard locked</h1>
      <p>${ADMIN_DASHBOARD_LOCKED_MESSAGE}</p>
      <p>Set up the administrator email and password by running this command from any folder:</p>
      <pre><code>${escapeHtml(setupCommand)}</code></pre>
      ${disableCommand
        ? `<p>For this local instance, you can instead disable dashboard authentication:</p>
      <pre><code>${escapeHtml(disableCommand)}</code></pre>
      `
        : ""}<p>To learn more about dashboard login: <a href="${ADMIN_DASHBOARD_LOGIN_HELP_URL}">Manage the dashboard login</a></p>
    </main>
  </body>
</html>
`
    : `${ADMIN_DASHBOARD_LOCKED_MESSAGE}\n\n` +
      "Set up the administrator email and password:\n" +
      `${setupCommand}\n` +
      (disableCommand
        ? "\nFor this local instance, you can instead disable dashboard " +
          `authentication:\n${disableCommand}\n`
        : "") +
      `\nTo learn more about dashboard login: ${ADMIN_DASHBOARD_LOGIN_HELP_URL}\n`;
  return new Response(body, {
    headers: {
      "content-type": html
        ? "text/html; charset=utf-8"
        : "text/plain; charset=utf-8",
    },
    status: 403,
  });
}
