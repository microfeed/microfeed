export interface AdminOwner {
  email: string;
  id: string;
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

export function adminDashboardLockedResponse(): Response {
  return new Response(
    "The admin dashboard is locked until its owner creates a password.",
    {
      headers: {"content-type": "text/plain; charset=utf-8"},
      status: 403,
    },
  );
}
