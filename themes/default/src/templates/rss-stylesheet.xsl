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
        <title><xsl:value-of select="rss/channel/title"/> · RSS feed</title>
        <style>
          /* microfeed:compiled-tailwind */
        </style>
      </head>
      <body class="rss-page">
        <main class="rss-container">
          <div class="rss-content">
            <header class="podcast-header">
              <div class="podcast-header-image-title">
                <xsl:choose>
                  <xsl:when test="rss/channel/image/url">
                    <div class="podcast-image">
                      <a target="_blank" rel="noopener">
                        <xsl:attribute name="href"><xsl:value-of select="rss/channel/image/link"/></xsl:attribute>
                        <img>
                          <xsl:attribute name="src"><xsl:value-of select="rss/channel/image/url"/></xsl:attribute>
                          <xsl:attribute name="alt"><xsl:value-of select="rss/channel/image/title"/></xsl:attribute>
                          <xsl:attribute name="title"><xsl:value-of select="rss/channel/image/title"/></xsl:attribute>
                        </img>
                      </a>
                    </div>
                  </xsl:when>
                  <xsl:when test="rss/channel/itunes:image/@href">
                    <div class="podcast-image">
                      <img>
                        <xsl:attribute name="src"><xsl:value-of select="rss/channel/itunes:image/@href"/></xsl:attribute>
                        <xsl:attribute name="alt"><xsl:value-of select="rss/channel/title"/></xsl:attribute>
                      </img>
                    </div>
                  </xsl:when>
                </xsl:choose>

                <div>
                  <h1><xsl:value-of select="rss/channel/title"/></h1>
                  <xsl:if test="rss/channel/itunes:author">
                    <p>By <span class="podcast-author"><xsl:value-of select="rss/channel/itunes:author"/></span></p>
                  </xsl:if>

                  <xsl:if test="rss/channel/itunes:category">
                    <div class="category-container">
                      Categories:
                      <xsl:for-each select="rss/channel/itunes:category">
                        <span class="category-item"><xsl:value-of select="@text"/></span>
                        <xsl:if test="itunes:category/@text">
                          <span class="category-item"><xsl:value-of select="itunes:category/@text"/></span>
                        </xsl:if>
                      </xsl:for-each>
                    </div>
                  </xsl:if>

                  <xsl:if test="rss/channel/link[1]">
                    <p>
                      <a target="_blank" rel="noopener">
                        <xsl:attribute name="href"><xsl:value-of select="rss/channel/link[1]"/></xsl:attribute>
                        Website <span class="icon-arrow-right"></span>
                      </a>
                    </p>
                  </xsl:if>
                </div>
              </div>

              <xsl:if test="rss/channel/description">
                <div class="podcast-description">
                  <xsl:value-of select="rss/channel/description" disable-output-escaping="yes"/>
                </div>
              </xsl:if>
            </header>

            <section aria-label="Feed items">
              <xsl:for-each select="rss/channel/item">
                <article class="item">
                  <xsl:if test="itunes:image/@href">
                    <a class="episode-image" target="_blank" rel="noopener">
                      <xsl:attribute name="href"><xsl:value-of select="itunes:image/@href"/></xsl:attribute>
                      <img alt="">
                        <xsl:attribute name="src"><xsl:value-of select="itunes:image/@href"/></xsl:attribute>
                      </img>
                    </a>
                  </xsl:if>

                  <h2>
                    <a target="_blank" rel="noopener">
                      <xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
                      <xsl:value-of select="title"/> <span class="icon-arrow-right"></span>
                    </a>
                  </h2>

                  <div class="episode-time">
                    <xsl:value-of select="pubDate"/>
                    <xsl:if test="itunes:duration">
                      · <xsl:value-of select="itunes:duration"/>
                    </xsl:if>
                  </div>

                  <xsl:if test="description">
                    <div>
                      <xsl:value-of select="description" disable-output-escaping="yes"/>
                    </div>
                  </xsl:if>

                  <xsl:if test="enclosure/@url">
                    <xsl:choose>
                      <xsl:when test="starts-with(enclosure/@type, 'audio')">
                        <audio controls="controls" preload="metadata">
                          <xsl:attribute name="src"><xsl:value-of select="enclosure/@url"/></xsl:attribute>
                        </audio>
                      </xsl:when>
                      <xsl:when test="starts-with(enclosure/@type, 'video')">
                        <video controls="controls" preload="metadata">
                          <xsl:attribute name="src"><xsl:value-of select="enclosure/@url"/></xsl:attribute>
                        </video>
                      </xsl:when>
                      <xsl:when test="starts-with(enclosure/@type, 'image')">
                        <a class="enclosure-link" target="_blank" rel="noopener">
                          <xsl:attribute name="href"><xsl:value-of select="enclosure/@url"/></xsl:attribute>
                          <img alt="">
                            <xsl:attribute name="src"><xsl:value-of select="enclosure/@url"/></xsl:attribute>
                          </img>
                        </a>
                      </xsl:when>
                      <xsl:when test="starts-with(enclosure/@type, 'text')">
                        <a class="enclosure-link" target="_blank" rel="noopener">
                          <xsl:attribute name="href"><xsl:value-of select="enclosure/@url"/></xsl:attribute>
                          View <span class="icon-arrow-right"></span>
                        </a>
                      </xsl:when>
                      <xsl:otherwise>
                        <a class="enclosure-link" target="_blank" rel="noopener">
                          <xsl:attribute name="href"><xsl:value-of select="enclosure/@url"/></xsl:attribute>
                          Download <span class="icon-arrow-right"></span>
                        </a>
                      </xsl:otherwise>
                    </xsl:choose>
                  </xsl:if>
                </article>
              </xsl:for-each>
            </section>

            <xsl:if test="rss/channel/atom:link[@rel='prev' or @rel='next']">
              <nav class="pagination" aria-label="Pagination">
                <xsl:if test="rss/channel/atom:link[@rel='prev']">
                  <a>
                    <xsl:attribute name="href"><xsl:value-of select="rss/channel/atom:link[@rel='prev']/@href"/></xsl:attribute>
                    <span class="icon-arrow-left"></span> Prev
                  </a>
                </xsl:if>
                <xsl:if test="rss/channel/atom:link[@rel='next']">
                  <a>
                    <xsl:attribute name="href"><xsl:value-of select="rss/channel/atom:link[@rel='next']/@href"/></xsl:attribute>
                    Next <span class="icon-arrow-right"></span>
                  </a>
                </xsl:if>
              </nav>
            </xsl:if>
          </div>

          <footer class="text-sm text-center">
            <xsl:if test="rss/channel/copyright">
              <div><xsl:value-of select="rss/channel/copyright"/></div>
            </xsl:if>
            <div>
              Powered by <a href="https://www.microfeed.org/">microfeed</a>
              (a <a href="https://www.listennotes.com/">Listen Notes</a> project)
            </div>
          </footer>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
