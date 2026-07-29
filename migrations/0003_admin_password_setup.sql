CREATE TABLE IF NOT EXISTS "auth_password_setup" (
  "id" TEXT NOT NULL PRIMARY KEY CHECK ("id" = 'owner'),
  "purpose" TEXT NOT NULL CHECK ("purpose" IN ('initial', 'reset')),
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "expiresAt" DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS "auth_password_setup_tokenHash_idx"
  ON "auth_password_setup" ("tokenHash");
