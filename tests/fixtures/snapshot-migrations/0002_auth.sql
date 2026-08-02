CREATE TABLE fixture_auth_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);

INSERT INTO fixture_auth_user (id, email)
VALUES ('owner', 'owner@example.com');
