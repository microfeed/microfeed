-- Give new and newly upgraded sites an editable public Contact page. The
-- Personal theme renders its built-in contact form on any Page whose slug is
-- "contact" (see themes/personal/web-page.mustache and the is_contact_page
-- hook in src/server/themes/Theme.ts). The page body stays editable in Admin;
-- the form is appended automatically.
-- Preserve an existing /contact/ Page instead of replacing user content.
INSERT INTO pages (
  id, slug, title, content_html, content_text, status,
  meta_description, show_in_navigation, navigation_label,
  navigation_order, published_at, created_at, updated_at
)
SELECT
  'starter-contact',
  'contact',
  'Contact',
  '<p>Get in touch. Fill out the form below and I will get back to you.</p>',
  'Get in touch. Fill out the form below and I will get back to you.',
  1,
  'Get in touch with the site owner.',
  1,
  'Contact',
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
  WHERE slug = 'contact' COLLATE NOCASE
)
AND NOT EXISTS (
  SELECT 1 FROM pages
  WHERE slug = 'contact' COLLATE NOCASE OR id = 'starter-contact'
);

INSERT INTO page_paths (slug, page_id, is_current, created_at)
SELECT 'contact', 'starter-contact', 1, CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM pages
  WHERE id = 'starter-contact' AND slug = 'contact' COLLATE NOCASE
)
AND NOT EXISTS (
  SELECT 1 FROM page_paths
  WHERE slug = 'contact' COLLATE NOCASE
);
