CREATE TABLE IF NOT EXISTS "passkey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT,
  "publicKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "credentialID" TEXT NOT NULL,
  "counter" INTEGER NOT NULL,
  "deviceType" TEXT NOT NULL,
  "backedUp" INTEGER NOT NULL,
  "transports" TEXT,
  "createdAt" DATE,
  "aaguid" TEXT
);

CREATE INDEX IF NOT EXISTS "passkey_userId_idx"
  ON "passkey" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "passkey_credentialID_idx"
  ON "passkey" ("credentialID");

CREATE TABLE IF NOT EXISTS "oauth_connection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES "oauth_client" ("clientId") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "lastUsedAt" DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_connection_owner_idx"
  ON "oauth_connection" ("id", "clientId", "userId");
CREATE INDEX IF NOT EXISTS "oauth_connection_clientId_idx"
  ON "oauth_connection" ("clientId");
CREATE INDEX IF NOT EXISTS "oauth_connection_userId_idx"
  ON "oauth_connection" ("userId");

CREATE INDEX IF NOT EXISTS "oauth_consent_referenceId_idx"
  ON "oauth_consent" ("referenceId");
CREATE INDEX IF NOT EXISTS "oauth_access_token_referenceId_idx"
  ON "oauth_access_token" ("referenceId");
CREATE INDEX IF NOT EXISTS "oauth_refresh_token_referenceId_idx"
  ON "oauth_refresh_token" ("referenceId");
