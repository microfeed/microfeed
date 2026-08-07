CREATE TABLE IF NOT EXISTS "oauth_client" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL UNIQUE,
  "clientSecret" TEXT,
  "disabled" INTEGER DEFAULT 0,
  "skipConsent" INTEGER,
  "enableEndSession" INTEGER,
  "subjectType" TEXT,
  "scopes" TEXT,
  "userId" TEXT REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "createdAt" DATE,
  "updatedAt" DATE,
  "name" TEXT,
  "uri" TEXT,
  "icon" TEXT,
  "contacts" TEXT,
  "tos" TEXT,
  "policy" TEXT,
  "softwareId" TEXT,
  "softwareVersion" TEXT,
  "softwareStatement" TEXT,
  "redirectUris" TEXT NOT NULL,
  "postLogoutRedirectUris" TEXT,
  "tokenEndpointAuthMethod" TEXT,
  "grantTypes" TEXT,
  "responseTypes" TEXT,
  "public" INTEGER,
  "type" TEXT,
  "requirePKCE" INTEGER,
  "referenceId" TEXT,
  "metadata" TEXT
);

CREATE TABLE IF NOT EXISTS "oauth_refresh_token" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "clientId" TEXT NOT NULL REFERENCES "oauth_client" ("clientId") ON DELETE CASCADE,
  "sessionId" TEXT REFERENCES "auth_session" ("id") ON DELETE SET NULL,
  "userId" TEXT NOT NULL REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "referenceId" TEXT,
  "expiresAt" DATE NOT NULL,
  "createdAt" DATE NOT NULL,
  "revoked" DATE,
  "authTime" DATE,
  "scopes" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauth_access_token" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "clientId" TEXT NOT NULL REFERENCES "oauth_client" ("clientId") ON DELETE CASCADE,
  "sessionId" TEXT REFERENCES "auth_session" ("id") ON DELETE SET NULL,
  "userId" TEXT REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "referenceId" TEXT,
  "refreshId" TEXT REFERENCES "oauth_refresh_token" ("id") ON DELETE CASCADE,
  "expiresAt" DATE NOT NULL,
  "createdAt" DATE NOT NULL,
  "scopes" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "oauth_consent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES "oauth_client" ("clientId") ON DELETE CASCADE,
  "userId" TEXT REFERENCES "auth_user" ("id") ON DELETE CASCADE,
  "referenceId" TEXT,
  "scopes" TEXT NOT NULL,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS "oauth_client_userId_idx"
  ON "oauth_client" ("userId");
CREATE INDEX IF NOT EXISTS "oauth_refresh_token_clientId_idx"
  ON "oauth_refresh_token" ("clientId");
CREATE INDEX IF NOT EXISTS "oauth_refresh_token_sessionId_idx"
  ON "oauth_refresh_token" ("sessionId");
CREATE INDEX IF NOT EXISTS "oauth_refresh_token_userId_idx"
  ON "oauth_refresh_token" ("userId");
CREATE INDEX IF NOT EXISTS "oauth_access_token_clientId_idx"
  ON "oauth_access_token" ("clientId");
CREATE INDEX IF NOT EXISTS "oauth_access_token_sessionId_idx"
  ON "oauth_access_token" ("sessionId");
CREATE INDEX IF NOT EXISTS "oauth_access_token_userId_idx"
  ON "oauth_access_token" ("userId");
CREATE INDEX IF NOT EXISTS "oauth_access_token_refreshId_idx"
  ON "oauth_access_token" ("refreshId");
CREATE INDEX IF NOT EXISTS "oauth_consent_clientId_idx"
  ON "oauth_consent" ("clientId");
CREATE INDEX IF NOT EXISTS "oauth_consent_userId_idx"
  ON "oauth_consent" ("userId");

INSERT OR IGNORE INTO "oauth_client" (
  "id",
  "clientId",
  "disabled",
  "skipConsent",
  "scopes",
  "createdAt",
  "updatedAt",
  "name",
  "redirectUris",
  "tokenEndpointAuthMethod",
  "grantTypes",
  "responseTypes",
  "public",
  "type",
  "requirePKCE"
) VALUES (
  'microfeed-cli',
  'microfeed-cli',
  0,
  0,
  '["content:read","content:write","offline_access"]',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'microfeed CLI',
  '["http://127.0.0.1:8977/callback"]',
  'none',
  '["authorization_code","refresh_token"]',
  '["code"]',
  1,
  'native',
  1
);
