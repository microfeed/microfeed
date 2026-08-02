export interface AdminOwner {
  email: string;
  id: string;
}

export const ADMIN_DASHBOARD_LOGIN_HELP_URL =
  "https://github.com/microfeed/microfeed#manage-the-dashboard-login";

const ADMIN_DASHBOARD_LOCKED_MESSAGE =
  "The admin dashboard is locked until its owner creates a password.";

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
): Response {
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
      <p><a href="${ADMIN_DASHBOARD_LOGIN_HELP_URL}">Manage the dashboard login</a></p>
    </main>
  </body>
</html>
`
    : `${ADMIN_DASHBOARD_LOCKED_MESSAGE}\n\n` +
      `Manage the dashboard login: ${ADMIN_DASHBOARD_LOGIN_HELP_URL}\n`;
  return new Response(body, {
    headers: {
      "content-type": html
        ? "text/html; charset=utf-8"
        : "text/plain; charset=utf-8",
    },
    status: 403,
  });
}
