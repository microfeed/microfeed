CREATE TABLE fixture_channels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL
);

INSERT INTO fixture_channels (id, title)
VALUES ('fixture', 'Migrated Title');
