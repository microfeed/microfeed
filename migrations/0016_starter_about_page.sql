-- Give new and newly upgraded sites an editable example of a public Page.
-- Preserve an existing /about/ Page instead of replacing user content.
INSERT INTO pages (
  id, slug, title, content_html, content_text, status,
  meta_description, show_in_navigation, navigation_label,
  navigation_order, published_at, created_at, updated_at
)
SELECT
  'starter-about',
  'about',
  'About',
  '<p>This is the About page for this microfeed site. Edit it to introduce your site, publication, or project.</p>',
  'This is the About page for this microfeed site. Edit it to introduce your site, publication, or project.',
  1,
  'Learn more about this microfeed site.',
  1,
  'About',
  (
    SELECT COALESCE(MAX(navigation_order), 0) + 10
    FROM pages
    WHERE status != 3 AND show_in_navigation = 1
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM page_paths
  WHERE slug = 'about' COLLATE NOCASE
)
AND NOT EXISTS (
  SELECT 1 FROM pages
  WHERE slug = 'about' COLLATE NOCASE OR id = 'starter-about'
);

INSERT INTO page_paths (slug, page_id, is_current, created_at)
SELECT 'about', 'starter-about', 1, CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM pages
  WHERE id = 'starter-about' AND slug = 'about' COLLATE NOCASE
)
AND NOT EXISTS (
  SELECT 1 FROM page_paths
  WHERE slug = 'about' COLLATE NOCASE
);
