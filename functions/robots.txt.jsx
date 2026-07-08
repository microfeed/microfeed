// PRD_SEO_GEO.md Phase 3 (§5): crawler-facing robots.txt. Disallows the
// admin UI and API, and points crawlers at the sitemap so both regular
// search crawlers and GEO/AI crawlers can discover the site's URLs.
export async function onRequestGet({request}) {
  const {origin} = new URL(request.url);

  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {"content-type": "text/plain; charset=utf-8"},
  });
}
