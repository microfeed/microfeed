CREATE TABLE IF NOT EXISTS "microfeed_installation" (
  "id" TEXT NOT NULL PRIMARY KEY CHECK ("id" = 'installation'),
  "instanceId" TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Early web-deployed installations created before this migration all published
-- this legacy identity. Preserve it when upgrading; new installations get a
-- unique identity from the Worker after migrations and before verification.
INSERT OR IGNORE INTO "microfeed_installation" ("id", "instanceId")
SELECT 'installation', 'microfeed-cloudflare-deploy'
WHERE EXISTS (SELECT 1 FROM "auth_user");
