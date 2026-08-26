<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:atom="http://www.w3.org/2005/Atom"
                xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
                exclude-result-prefixes="atom itunes">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html class="rss-document" lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="rss/channel/title"/> · Podcast RSS</title>
        <style>/* microfeed:compiled-theme */</style>
      </head>
      <body class="rss-page">
        <main class="rss-container">
          <header class="rss-header">
            <p class="pod-kicker">Podcast RSS feed</p>
            <h1><xsl:value-of select="rss/channel/title"/></h1>
            <xsl:if test="rss/channel/itunes:author"><p>Hosted by <xsl:value-of select="rss/channel/itunes:author"/></p></xsl:if>
            <xsl:if test="rss/channel/description"><div><xsl:value-of select="rss/channel/description" disable-output-escaping="yes"/></div></xsl:if>
            <xsl:if test="rss/channel/link[1]"><p><a><xsl:attribute name="href"><xsl:value-of select="rss/channel/link[1]"/></xsl:attribute>Visit the website →</a></p></xsl:if>
          </header>
          <section aria-label="Episodes">
            <xsl:for-each select="rss/channel/item">
              <article class="rss-item">
                <div class="rss-meta"><xsl:value-of select="pubDate"/><xsl:if test="itunes:duration"> · <xsl:value-of select="itunes:duration"/></xsl:if></div>
                <h2><a><xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute><xsl:value-of select="title"/></a></h2>
                <xsl:if test="description"><div><xsl:value-of select="description" disable-output-escaping="yes"/></div></xsl:if>
                <xsl:if test="enclosure/@url">
                  <xsl:choose>
                    <xsl:when test="starts-with(enclosure/@type, 'audio')"><audio controls="controls" preload="metadata"><xsl:attribute name="src"><xsl:value-of select="enclosure/@url"/></xsl:attribute></audio></xsl:when>
                    <xsl:when test="starts-with(enclosure/@type, 'video')"><video controls="controls" preload="metadata"><xsl:attribute name="src"><xsl:value-of select="enclosure/@url"/></xsl:attribute></video></xsl:when>
                    <xsl:when test="starts-with(enclosure/@type, 'image')"><a><xsl:attribute name="href"><xsl:value-of select="enclosure/@url"/></xsl:attribute><img alt=""><xsl:attribute name="src"><xsl:value-of select="enclosure/@url"/></xsl:attribute></img></a></xsl:when>
                    <xsl:otherwise><p><a><xsl:attribute name="href"><xsl:value-of select="enclosure/@url"/></xsl:attribute>Open attachment →</a></p></xsl:otherwise>
                  </xsl:choose>
                </xsl:if>
              </article>
            </xsl:for-each>
          </section>
          <xsl:if test="rss/channel/atom:link[@rel='prev' or @rel='next']">
            <nav class="pod-pagination" aria-label="Pagination">
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
