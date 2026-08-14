<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/">
    <html>
      <head>
        <title><xsl:value-of select="rss/channel/title"/></title>
        <style>
          :root {
            --mf-accent: #9a6b4f;
            --mf-background: #fcfbf7;
            --mf-surface: #f4f1ea;
            --mf-text: #292420;
            --mf-muted: #6f675e;
            --mf-border: #e5dfd3;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: var(--mf-background);
            color: var(--mf-text);
            font-family: Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif;
            line-height: 1.7;
          }
          main { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem; }
          h1 { font-size: 2rem; line-height: 1.25; }
          a { color: var(--mf-accent); text-decoration: none; }
          a:hover { text-decoration: underline; }
          .mf-feed-description { color: var(--mf-muted); }
          .mf-feed-list { list-style: none; margin: 0; padding: 0; }
          .mf-feed-item { padding: 1.5rem 0; border-bottom: 1px solid var(--mf-border); }
          .mf-feed-item:first-child { border-top: 1px solid var(--mf-border); }
          .mf-feed-date {
            display: block;
            font-size: 0.8rem;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--mf-muted);
            margin-bottom: 0.35rem;
          }
          .mf-feed-title { font-size: 1.3rem; margin: 0 0 0.4rem; }
          .mf-feed-title a { color: var(--mf-text); }
          .mf-feed-excerpt { color: var(--mf-muted); margin: 0; font-size: 0.95rem; }
        </style>
      </head>
      <body>
        <main>
          <h1><xsl:value-of select="rss/channel/title"/></h1>
          <p class="mf-feed-description"><xsl:value-of select="rss/channel/description"/></p>
          <ul class="mf-feed-list">
            <xsl:for-each select="rss/channel/item">
              <li class="mf-feed-item">
                <time class="mf-feed-date"><xsl:value-of select="pubDate"/></time>
                <h2 class="mf-feed-title">
                  <a href="{link}"><xsl:value-of select="title"/></a>
                </h2>
                <p class="mf-feed-excerpt"><xsl:value-of select="description"/></p>
              </li>
            </xsl:for-each>
          </ul>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
