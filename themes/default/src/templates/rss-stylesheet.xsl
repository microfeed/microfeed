<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/">
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="rss/channel/title"/> · RSS</title>
        <style>
          :root{color-scheme:light dark;--accent:#e11d48;--bg:#fffdf8;--surface:#fff;--text:#18181b;--muted:#71717a;--border:#e4e4e7}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{width:min(100% - 2rem,76rem);margin:auto}.mast{border-bottom:1px solid var(--border);padding:2rem 0}.eyebrow{color:var(--accent);font-size:.72rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}h1{font-size:clamp(2.6rem,8vw,5.5rem);letter-spacing:-.05em;line-height:.95;margin:.6rem 0 1rem}.intro{color:var(--muted);font-size:1.08rem;line-height:1.7;max-width:45rem}.notice{background:var(--text);color:var(--bg);padding:.9rem 0;text-align:center}.items{display:grid;gap:1rem;padding:2.5rem 0}.item{background:var(--surface);border:1px solid var(--border);border-radius:1rem;padding:1.5rem}.item:hover{border-color:var(--accent)}h2{margin:.4rem 0;font-size:clamp(1.4rem,4vw,2rem);line-height:1.1}.item a{color:inherit;text-decoration:none}.date{color:var(--muted);font-size:.82rem}.description{color:var(--muted);line-height:1.65}@media(prefers-color-scheme:dark){:root{--accent:#fb7185;--bg:#18181b;--surface:#27272a;--text:#fafafa;--muted:#a1a1aa;--border:#3f3f46}}
        </style>
      </head>
      <body>
        <div class="notice">This is a human-friendly RSS feed. Subscribe using the feed URL in your reader.</div>
        <header class="mast"><div class="shell"><p class="eyebrow">RSS feed</p><h1><xsl:value-of select="rss/channel/title"/></h1><p class="intro"><xsl:value-of select="rss/channel/description"/></p></div></header>
        <main class="shell items"><xsl:for-each select="rss/channel/item"><article class="item"><p class="date"><xsl:value-of select="pubDate"/></p><h2><a><xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute><xsl:value-of select="title"/></a></h2><p class="description"><xsl:value-of select="description" disable-output-escaping="yes"/></p></article></xsl:for-each></main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
