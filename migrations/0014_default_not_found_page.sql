-- Reserve /404/ for a built-in editable Page. If a current Page already owns
-- that path, preserve its content and promote it to the protected 404 Page.
DELETE FROM page_paths
WHERE slug = '404' COLLATE NOCASE AND is_current = 0;

INSERT INTO pages (
  id, slug, title, content_html, content_text, status,
  meta_description, show_in_navigation, navigation_label,
  navigation_order, published_at, created_at, updated_at
)
SELECT
  'system-404',
  '404',
  'Page not found',
  '<p>The page you requested could not be found.</p>',
  'The page you requested could not be found.',
  1,
  'The page you requested could not be found.',
  0,
  'Page not found',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM page_paths
  WHERE slug = '404' COLLATE NOCASE AND is_current = 1
)
AND NOT EXISTS (
  SELECT 1 FROM pages WHERE id = 'system-404'
);

INSERT OR IGNORE INTO page_paths (slug, page_id, is_current, created_at)
SELECT '404', 'system-404', 1, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM pages WHERE id = 'system-404')
AND NOT EXISTS (
  SELECT 1 FROM page_paths
  WHERE slug = '404' COLLATE NOCASE
);

UPDATE pages
SET
  slug = '404',
  status = 1,
  show_in_navigation = 0,
  navigation_label = title,
  navigation_order = 0,
  published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
  updated_at = CURRENT_TIMESTAMP
WHERE id = (
  SELECT page_id FROM page_paths
  WHERE slug = '404' COLLATE NOCASE AND is_current = 1
  LIMIT 1
);

-- The 404 Page is discoverable through Admin and the Page API, but not public
-- search. Keep its derived search row absent after every future edit.
DROP TRIGGER IF EXISTS pages_site_search_after_insert;
DROP TRIGGER IF EXISTS pages_site_search_after_update;

CREATE TRIGGER pages_site_search_after_insert
AFTER INSERT ON pages
WHEN NEW.status != 3 AND NEW.slug != '404' COLLATE NOCASE
BEGIN
  INSERT INTO site_search_documents (
    content_type, content_id, status, title, content_text,
    published_at, updated_at, image
  ) VALUES (
    'page', NEW.id, NEW.status, NEW.title, NEW.content_text,
    NEW.published_at, NEW.updated_at, NULL
  );
END;

CREATE TRIGGER pages_site_search_after_update
AFTER UPDATE ON pages
BEGIN
  DELETE FROM site_search_documents
  WHERE content_type = 'page' AND content_id = OLD.id;
  INSERT INTO site_search_documents (
    content_type, content_id, status, title, content_text,
    published_at, updated_at, image
  )
  SELECT
    'page', NEW.id, NEW.status, NEW.title, NEW.content_text,
    NEW.published_at, NEW.updated_at, NULL
  WHERE NEW.status != 3 AND NEW.slug != '404' COLLATE NOCASE;
END;

DELETE FROM site_search_documents
WHERE content_type = 'page'
  AND content_id = (
    SELECT page_id FROM page_paths
    WHERE slug = '404' COLLATE NOCASE AND is_current = 1
    LIMIT 1
  );
