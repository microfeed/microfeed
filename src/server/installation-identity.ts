const INSTALLATION_RECORD_ID = "installation";

interface InstallationIdentityRow {
  instanceId: string;
}

async function savedInstallationIdentity(
  database: D1Database,
): Promise<string | null> {
  const row = await database.prepare(
    'SELECT "instanceId" FROM "microfeed_installation" WHERE "id" = ?',
  ).bind(INSTALLATION_RECORD_ID).first<InstallationIdentityRow>();
  return row?.instanceId ?? null;
}

export async function installationInstanceId(
  database: D1Database,
  configuredInstanceId?: string | null,
): Promise<string> {
  const configured = configuredInstanceId?.trim();
  const saved = await savedInstallationIdentity(database);

  if (configured) {
    if (saved !== configured) {
      await database.prepare(
        'INSERT INTO "microfeed_installation" ("id", "instanceId") ' +
          'VALUES (?, ?) ON CONFLICT ("id") DO UPDATE SET ' +
          '"instanceId" = excluded."instanceId"',
      ).bind(INSTALLATION_RECORD_ID, configured).run();
    }
    return configured;
  }

  if (saved) {
    return saved;
  }

  const candidate = crypto.randomUUID();
  await database.prepare(
    'INSERT OR IGNORE INTO "microfeed_installation" ("id", "instanceId") ' +
      "VALUES (?, ?)",
  ).bind(INSTALLATION_RECORD_ID, candidate).run();
  const persisted = await savedInstallationIdentity(database);
  if (!persisted) {
    throw new Error("microfeed could not create its installation identity.");
  }
  return persisted;
}
