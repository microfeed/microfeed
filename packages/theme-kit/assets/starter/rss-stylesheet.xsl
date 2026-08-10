<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/">
    <html><head><title><xsl:value-of select="rss/channel/title"/></title></head>
    <body><main><h1><xsl:value-of select="rss/channel/title"/></h1>
      <xsl:for-each select="rss/channel/item"><article><h2><xsl:value-of select="title"/></h2></article></xsl:for-each>
    </main></body></html>
  </xsl:template>
</xsl:stylesheet>
