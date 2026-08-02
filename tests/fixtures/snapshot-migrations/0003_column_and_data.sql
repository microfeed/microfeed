ALTER TABLE fixture_channels ADD COLUMN slug TEXT;

UPDATE fixture_channels
SET slug = lower(replace(title, ' ', '-'));
