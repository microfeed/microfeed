import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {DatabaseSync} from "node:sqlite";

import {describe, expect, it} from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

async function migration(filename: string): Promise<string> {
  return readFile(path.join(repositoryRoot, "migrations", filename), "utf8");
}

async function pagesDatabase(): Promise<DatabaseSync> {
  const database = new DatabaseSync(":memory:");
  database.exec(await migration("0001_initial.sql"));
  database.exec(await migration("0009_item_search.sql"));
  database.exec(await migration("0013_pages_search_site_files.sql"));
  database.exec(await migration("0014_default_not_found_page.sql"));
  return database;
}

describe("starter About Page migration", () => {
  it("creates a published, searchable About Page in navigation", async () => {
    const database = await pagesDatabase();
    const aboutMigration = await migration("0016_starter_about_page.sql");

    database.exec(aboutMigration);
    database.exec(aboutMigration);

    expect(database.prepare(`
      SELECT
        p.id, p.slug, p.title, p.content_text, p.meta_description, p.status,
        p.show_in_navigation, p.navigation_label, p.navigation_order,
        p.published_at IS NOT NULL AS has_published_at, pp.is_current
      FROM pages p
      JOIN page_paths pp ON pp.page_id = p.id AND pp.slug = p.slug
      WHERE p.slug = 'about' COLLATE NOCASE
    `).get()).toEqual({
      content_text:
        "This is the About page for this microfeed site. " +
        "Edit it to introduce your site, publication, or project.",
      has_published_at: 1,
      id: "starter-about",
      is_current: 1,
      meta_description: "Learn more about this microfeed site.",
      navigation_label: "About",
      navigation_order: 10,
      show_in_navigation: 1,
      slug: "about",
      status: 1,
      title: "About",
    });
    expect(database.prepare(
      "SELECT content_id FROM site_search_exact " +
        "WHERE site_search_exact MATCH 'publication'",
    ).all()).toEqual([{content_id: "starter-about"}]);
    expect(database.prepare(
      "SELECT COUNT(*) AS count FROM pages WHERE slug = 'about'",
    ).get()).toEqual({count: 1});
  });

  it("preserves an existing /about/ Page", async () => {
    const database = await pagesDatabase();
    database.prepare(`
      INSERT INTO pages (
        id, slug, title, content_html, content_text, status,
        show_in_navigation, navigation_label, navigation_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "custom-about",
      "about",
      "Our story",
      "<p>Keep this content.</p>",
      "Keep this content.",
      1,
      1,
      "Our story",
      20,
    );
    database.prepare(`
      INSERT INTO page_paths (slug, page_id, is_current)
      VALUES ('about', 'custom-about', 1)
    `).run();

    database.exec(await migration("0016_starter_about_page.sql"));

    expect(database.prepare(
      "SELECT id, title, content_text FROM pages " +
        "WHERE slug = 'about' COLLATE NOCASE",
    ).all()).toEqual([{
      content_text: "Keep this content.",
      id: "custom-about",
      title: "Our story",
    }]);
    expect(database.prepare(
      "SELECT COUNT(*) AS count FROM pages WHERE id = 'starter-about'",
    ).get()).toEqual({count: 0});
  });

  it("places the starter after existing navigation Pages", async () => {
    const database = await pagesDatabase();
    database.prepare(`
      INSERT INTO pages (
        id, slug, title, status, show_in_navigation,
        navigation_label, navigation_order
      ) VALUES ('contact', 'contact', 'Contact', 1, 1, 'Contact', 30)
    `).run();
    database.prepare(`
      INSERT INTO page_paths (slug, page_id, is_current)
      VALUES ('contact', 'contact', 1)
    `).run();

    database.exec(await migration("0016_starter_about_page.sql"));

    expect(database.prepare(
      "SELECT navigation_order FROM pages WHERE id = 'starter-about'",
    ).get()).toEqual({navigation_order: 40});
  });
});
