<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>
          <xsl:value-of select="/rss/channel/title"/>
          - RSS Feed
        </title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        <style type="text/css">
          body {
          font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto
          Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";
          font-size: 14px;
          color: rgba(0, 0, 0, 0.80);
          background: rgba(0, 0, 0, 0.03);
          padding: 16px;
          line-height: 170%;
          }

          h1 {
          padding-top: 8px;
          line-height: 170%;
          }

          h2, p, a {
          line-height: 170%;
          }
          a, a:link, a:visited {
          color: #B82F00;
          text-decoration: none;
          }
          a:hover {
          opacity: 0.7;
          }
          .container {
          max-width: 800px;
          min-height: 600px;
          margin: 0 auto;
          background: #fff;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 3px fade(black, 10%);
          border: 1px solid rgba(0, 0, 0, 0.10);
          }
          .podcast-image {
          float: left;
          margin-bottom: 20px;
          margin-right: 20px;
          }
          .podcast-author {
          color: rgba(0, 0, 0, 0.60);
          }
          .podcast-image img {
          width: 200px;
          height: auto;
          border-radius: 4px;
          border: 1px solid rgba(0, 0, 0, 0.10);
          -webkit-box-shadow: rgba(0,0,0,0.1) 0 0 20px;
          -moz-box-shadow: rgba(0,0,0,0.1) 0 0 20px;
          box-shadow: rgba(0,0,0,0.1) 0 0 20px;
          }
          .podcast-header {
          margin-bottom: 20px;
          }
          .item {
          clear: both;
          border-top: 1px solid rgba(0, 0, 0, 0.10);
          padding: 24px 0;
          }
          audio {
          width: 100%;
          border-radius: 4px;
          }
          audio:focus {
          outline: none;
          }
          .episode-image img {
          width: 100px;
          height: auto;
          margin: 0 30px 15px 0;
          border-radius: 5px;
          }
          .episode-time {
          font-size: 12px;
          color: #8E8E8E;
          margin-bottom: 1em;
          }
          .view-website-link {
          text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="podcast-header">
            <h1>
              <xsl:if test="/rss/channel/image">
                <div class="podcast-image">
                  <a>
                    <xsl:attribute name="href">
                      <xsl:value-of select="/rss/channel/image/link"/>
                    </xsl:attribute>
                    <img>
                      <xsl:attribute name="src">
                        <xsl:value-of select="/rss/channel/image/url"/>
                      </xsl:attribute>
                      <xsl:attribute name="title">
                        <xsl:value-of select="/rss/channel/image/title"/>
                      </xsl:attribute>
                    </img>
                  </a>
                </div>
              </xsl:if>
              <xsl:value-of select="/rss/channel/title"/>
            </h1>
            <p>
              By
              <span class="podcast-author">
                <xsl:value-of select="/rss/channel/itunes:author"/>
              </span>
            </p>
            <p>
              <xsl:value-of select="/rss/channel/description"/>
            </p>
            <p class="view-website-link">
              <a>
                <xsl:attribute name="href">
                  <xsl:value-of select="/rss/channel/link[last()]"/>
                </xsl:attribute>
                <xsl:attribute name="target">_blank</xsl:attribute>
                View on listennotes.com &#x2192;
              </a>
            </p>
          </div>
          <xsl:for-each select="/rss/channel/item">
            <div class="item">
              <h2>
                <a>
                  <xsl:attribute name="href">
                    <xsl:value-of select="link"/>
                  </xsl:attribute>
                  <xsl:attribute name="target">_blank</xsl:attribute>
                  <xsl:value-of select="title"/>
                </a>
              </h2>
              <div class="episode-time">
                <span>
                  <xsl:value-of select="pubDate"/>
                </span> &#x02022;
                <span>
                  <xsl:value-of select="itunes:duration"/>
                </span>
              </div>
              <xsl:if test="description">
                <p>
                  <xsl:value-of select="description" disable-output-escaping="yes"/>
                </p>
              </xsl:if>

              <audio controls="true" preload="none">
                <xsl:attribute name="src">
                  <xsl:value-of select="enclosure/@url"/>
                </xsl:attribute>
              </audio>

            </div>
          </xsl:for-each>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
