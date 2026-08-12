-- Site File overrides are Mustache templates. Keep the last valid rendered
-- output so a later data change cannot turn a public file into an error.
ALTER TABLE site_files ADD COLUMN published_rendered_content TEXT;

UPDATE site_files
SET published_rendered_content = published_content
WHERE published_content IS NOT NULL;
