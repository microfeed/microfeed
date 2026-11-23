import {navigationPages} from "@/server/pages/service";
import {tagUrls} from "@/shared/Tags";
import {tagNavigationContext, TAG_NAVIGATION_LIMIT} from "@/shared/themes/ThemeTags";

/** Website-only shell data; never adds navigation to RSS or JSON Feed. */
export async function publicThemeNavigation(database: D1Database, request: Request) {
  const origin = new URL(request.url).origin;
  const [pages, tags] = await Promise.all([
    navigationPages(database, request),
    // No counts or memberships: one indexed, bounded query for the shared shell.
    database.prepare(`SELECT id, name, slug FROM tags WHERE deleted_at IS NULL
      ORDER BY name_key, id LIMIT ?`).bind(TAG_NAVIGATION_LIMIT)
      .all<{id: string; name: string; slug: string}>(),
  ]);
  return {
    navigation_pages: pages,
    tag_navigation: tagNavigationContext(tags.results.map(tag => ({
      ...tag, url: tagUrls(tag.slug, origin).url,
    })), new URL("/tags/", origin).href),
  };
}
