<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:atom="http://www.w3.org/2005/Atom"
                exclude-result-prefixes="atom">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html class="rss-document" lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="rss/channel/title"/> · Photo RSS</title>
        <style>/* microfeed:compiled-theme */</style>
      </head>
      <body class="rss-page">
        <main class="rss-container">
          <header class="rss-header">
            <div><p class="photo-kicker">Visual RSS feed</p><h1><xsl:value-of select="rss/channel/title"/></h1></div>
            <div>
              <xsl:if test="rss/channel/description"><div><xsl:value-of select="rss/channel/description" disable-output-escaping="yes"/></div></xsl:if>
              <xsl:if test="rss/channel/link[1]"><p><a><xsl:attribute name="href"><xsl:value-of select="rss/channel/link[1]"/></xsl:attribute>Open the contact sheet →</a></p></xsl:if>
            </div>
          </header>
          <section class="rss-grid" aria-label="Frames">
            <xsl:for-each select="rss/channel/item">
              <article class="rss-item">
                <xsl:if test="enclosure/@url">
                  <xsl:choose>
                    <xsl:when test="starts-with(enclosure/@type, 'image')"><a><xsl:attribute name="href"><xsl:value-of select="enclosure/@url"/></xsl:attribute><img alt=""><xsl:attribute name="src"><xsl:value-of select="enclosure/@url"/></xsl:attribute></img></a></xsl:when>
                    <xsl:when test="starts-with(enclosure/@type, 'video')"><video controls="controls" preload="metadata"><xsl:attribute name="src"><xsl:value-of select="enclosure/@url"/></xsl:attribute></video></xsl:when>
                    <xsl:when test="starts-with(enclosure/@type, 'audio')"><audio controls="controls" preload="metadata"><xsl:attribute name="src"><xsl:value-of select="enclosure/@url"/></xsl:attribute></audio></xsl:when>
                  </xsl:choose>
                </xsl:if>
                <div class="rss-meta"><xsl:value-of select="pubDate"/></div>
                <h2><a><xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute><xsl:value-of select="title"/></a></h2>
                <xsl:if test="description"><div><xsl:value-of select="description" disable-output-escaping="yes"/></div></xsl:if>
              </article>
            </xsl:for-each>
          </section>
          <xsl:if test="rss/channel/atom:link[@rel='prev' or @rel='next']">
            <nav class="photo-pagination" aria-label="Pagination">
              <xsl:if test="rss/channel/atom:link[@rel='prev']"><a><xsl:attribute name="href"><xsl:value-of select="rss/channel/atom:link[@rel='prev']/@href"/></xsl:attribute>← Newer</a></xsl:if>
              <xsl:if test="rss/channel/atom:link[@rel='next']"><a><xsl:attribute name="href"><xsl:value-of select="rss/channel/atom:link[@rel='next']/@href"/></xsl:attribute>Older →</a></xsl:if>
            </nav>
          </xsl:if>
          <footer class="rss-footer"><p>Published with <a href="https://www.microfeed.org/">microfeed</a></p></footer>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
