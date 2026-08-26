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
          /* microfeed design tokens
 * For a quick color change in Admin, edit only the values in this block.
 */
:root {
  --mf-accent: #0997cc;
  --mf-background: #ffffff;
  --mf-surface: #f6f8fa;
  --mf-text: #24292f;
  --mf-muted: #57606a;
  --mf-border: #dcdcdc;
}

.dark {
  --mf-accent: #58c7f3;
  --mf-background: #0d1117;
  --mf-surface: #161b22;
  --mf-text: #f0f3f6;
  --mf-muted: #9da7b3;
  --mf-border: #30363d;
}

/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */
@layer properties{@supports (((-webkit-hyphens:none)) and (not (margin-trim:inline))) or ((-moz-orient:inline) and (not (color:rgb(from red r g b)))){*,:before,:after,::backdrop{--tw-border-style:solid;--tw-font-weight:initial;--tw-outline-style:solid}}}@layer theme{:root,:host{--color-black:#000;--spacing:.25rem;--text-xs:.75rem;--text-xs--line-height:calc(1 / .75);--text-sm:.875rem;--text-sm--line-height:calc(1.25 / .875);--text-lg:1.125rem;--text-lg--line-height:calc(1.75 / 1.125);--font-weight-bold:700;--color-mf-accent:var(--mf-accent);--color-mf-background:var(--mf-background);--color-mf-surface:var(--mf-surface);--color-mf-text:var(--mf-text);--color-mf-muted:var(--mf-muted);--color-mf-border:var(--mf-border)}}@layer utilities{.visible{visibility:visible}.relative{position:relative}.container{width:100%}@media (width>=40rem){.container{max-width:40rem}}@media (width>=48rem){.container{max-width:48rem}}@media (width>=64rem){.container{max-width:64rem}}@media (width>=80rem){.container{max-width:80rem}}@media (width>=96rem){.container{max-width:96rem}}.mt-2{margin-top:calc(var(--spacing) * 2)}.mt-4{margin-top:calc(var(--spacing) * 4)}.mr-2{margin-right:calc(var(--spacing) * 2)}.mr-4{margin-right:calc(var(--spacing) * 4)}.mb-1{margin-bottom:var(--spacing)}.mb-2{margin-bottom:calc(var(--spacing) * 2)}.mb-4{margin-bottom:calc(var(--spacing) * 4)}.ml-1{margin-left:var(--spacing)}.block{display:block}.contents{display:contents}.flex{display:flex}.hidden{display:none}.inline{display:inline}.w-full{width:100%}.flex-1{flex:1}.flex-none{flex:none}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.justify-center{justify-content:center}.gap-2{gap:calc(var(--spacing) * 2)}.rounded-full{border-radius:2147483647px}.border{border-style:var(--tw-border-style);border-width:1px}.border-t{border-top-style:var(--tw-border-style);border-top-width:1px}.border-b{border-bottom-style:var(--tw-border-style);border-bottom-width:1px}.px-2{padding-inline:calc(var(--spacing) * 2)}.py-0{padding-block:0}.py-0\.5{padding-block:calc(var(--spacing) * .5)}.text-center{text-align:center}.text-lg{font-size:var(--text-lg);line-height:var(--tw-leading,var(--text-lg--line-height))}.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}.text-xs{font-size:var(--text-xs);line-height:var(--tw-leading,var(--text-xs--line-height))}.font-bold{--tw-font-weight:var(--font-weight-bold);font-weight:var(--font-weight-bold)}.text-black{color:var(--color-black)}.outline{outline-style:var(--tw-outline-style);outline-width:1px}}html{box-sizing:border-box;background:var(--mf-background);max-width:70ch;min-height:100%;color:var(--mf-text);margin:auto;padding:1.5em .2em;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen-Sans,Ubuntu,Cantarell,Helvetica Neue,sans-serif;font-size:1em;line-height:1.75}body{background:var(--mf-background);flex-direction:column;min-height:calc(100dvh - 3em);margin:0;display:flex}.dark{--lightningcss-light: ;--lightningcss-dark:initial;color-scheme:dark}main{flex:1 0 auto;width:100%}footer{flex:none}.mf-site-nav{border-bottom:1px solid var(--mf-border);flex:none;justify-content:space-between;align-items:center;gap:.75rem;width:100%;margin-bottom:2rem;padding-bottom:.75rem;display:flex;position:relative}.mf-site-brand{min-width:0;max-width:10rem;color:var(--mf-text);flex:none;align-items:center;font-weight:650;display:flex}.mf-site-brand:visited{color:var(--mf-text)}.mf-site-brand img{object-fit:cover;border-radius:.4rem;width:2rem;height:2rem}.mf-site-brand span{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.mf-site-search{border:1px solid var(--mf-border);background:var(--mf-background);width:min(13.5rem,38vw);color:var(--mf-text);border-radius:.55rem;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.35rem;margin-left:auto;padding:.2rem .5rem;transition:border-color .12s,box-shadow .12s;display:grid;position:relative}.mf-site-search:focus-within{border-color:var(--mf-accent);box-shadow:0 0 0 .18rem var(--mf-accent)}@supports (color:color-mix(in lab, red, red)){.mf-site-search:focus-within{box-shadow:0 0 0 .18rem color-mix(in srgb, var(--mf-accent) 20%, transparent)}}.mf-site-search input[type=search]{width:100%;min-width:0;color:var(--mf-text);cursor:pointer;font:inherit;background:0 0;border:0;outline:0;padding:0;font-size:.875rem;line-height:1.45}.mf-site-search input[type=search]::placeholder{color:var(--mf-muted)}.mf-site-search kbd{border:1px solid var(--mf-border);background:var(--mf-surface);color:var(--mf-muted);font:inherit;border-radius:.3rem;padding:.05rem .3rem;font-size:.72em;line-height:1.4}.mf-search-icon-graphic{width:1rem;height:1rem;color:var(--mf-muted)}.mf-search-icon-button{border:1px solid var(--mf-border);background:var(--mf-background);color:var(--mf-text);cursor:pointer;border-radius:.5rem;justify-content:center;align-items:center;padding:.4rem;display:none}.mf-nav-links{align-items:center;gap:.75rem;min-width:0;display:flex}.mf-nav-links>a{text-overflow:ellipsis;white-space:nowrap;max-width:10rem;display:block;overflow:hidden}.mf-nav-overflow{position:relative}.mf-nav-overflow summary{color:var(--mf-accent);cursor:pointer;align-items:center;gap:.2rem;font-weight:500;list-style:none;display:flex}.mf-nav-overflow summary::-webkit-details-marker{display:none}.mf-nav-overflow summary:hover{opacity:.65}.mf-nav-overflow[open] summary svg{transform:rotate(180deg)}.mf-nav-overflow-menu-icon{display:none}.mf-nav-overflow-menu{z-index:30;border:1px solid var(--mf-border);background:var(--mf-background);border-radius:.55rem;gap:.15rem;min-width:10rem;padding:.35rem;display:grid;position:absolute;top:calc(100% + .55rem);right:0;box-shadow:0 .7rem 2rem #00000024}.mf-nav-overflow-menu a{white-space:nowrap;border-radius:.35rem;padding:.35rem .55rem}.mf-nav-overflow-menu a:hover,.mf-nav-overflow-menu a:focus-visible{background:var(--mf-surface);opacity:1}.mf-theme-menu{flex:none;position:relative}.mf-theme-trigger{width:2.5rem;height:2.5rem;color:var(--mf-text);cursor:pointer;background:0 0;border:0;border-radius:999px;place-items:center;padding:0;list-style:none;transition:background-color .12s,color .12s;display:grid}.mf-theme-trigger:hover,.mf-theme-trigger[aria-expanded=true]{background:var(--mf-surface)}.mf-theme-trigger-icon{width:1.1rem;height:1.1rem;display:none}.mf-theme-trigger-icon[data-microfeed-theme-icon=light]{display:block}html[data-theme-preference=system] .mf-theme-trigger-icon,html[data-theme-preference=dark] .mf-theme-trigger-icon{display:none}html[data-theme-preference=system] .mf-theme-trigger-icon[data-microfeed-theme-icon=system],html[data-theme-preference=dark] .mf-theme-trigger-icon[data-microfeed-theme-icon=dark]{display:block}.mf-theme-menu-panel{z-index:40;border:1px solid var(--mf-border);background:var(--mf-background);border-radius:.65rem;gap:.1rem;min-width:10.5rem;padding:.35rem;display:grid;position:absolute;top:calc(100% + .45rem);right:0;box-shadow:0 .8rem 2.2rem #0000002e}.mf-theme-menu-panel[hidden]{display:none}.mf-theme-menu-label{color:var(--mf-muted);padding:.35rem .55rem;font-size:.75rem;font-weight:600}.mf-theme-menu-panel button{width:100%;color:var(--mf-text);cursor:pointer;font:inherit;text-align:left;background:0 0;border:0;border-radius:.4rem;grid-template-columns:1.1rem minmax(0,1fr) 1rem;align-items:center;gap:.5rem;padding:.45rem .55rem;font-size:.875rem;display:grid}.mf-theme-menu-panel button:after{color:var(--mf-accent);content:"";justify-self:end;font-weight:700}.mf-theme-menu-panel button[aria-checked=true]:after{content:"✓"}.mf-theme-menu-panel button:hover,.mf-theme-menu-panel button:focus-visible{background:var(--mf-surface);outline:0}.mf-footer-link,.mf-footer-link:visited{color:#19b7fa}.mf-back-link{margin-bottom:1rem}.mf-page{margin-bottom:4em}.mf-visually-hidden{clip:rect(0, 0, 0, 0);clip-path:inset(50%);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}html .mf-public-search{background:var(--mf-background);color:var(--mf-text);margin:auto;position:fixed;inset:0}html .mf-public-search::backdrop{background:#0f172a73}.mf-search-page h1{margin-bottom:1.25rem}.mf-search-page-form{margin:0}.mf-search-control{border:1px solid var(--mf-border);background:var(--mf-background);border-radius:.7rem;grid-template-columns:minmax(0,1fr) auto;transition:border-color .12s,box-shadow .12s;display:grid;overflow:hidden}.mf-search-control:focus-within{border-color:var(--mf-accent);box-shadow:0 0 0 .2rem var(--mf-accent)}@supports (color:color-mix(in lab, red, red)){.mf-search-control:focus-within{box-shadow:0 0 0 .2rem color-mix(in srgb, var(--mf-accent) 20%, transparent)}}.mf-search-control input[type=search]{box-sizing:border-box;background:var(--mf-background);width:100%;min-width:0;color:var(--mf-text);font:inherit;border:0;border-radius:0;outline:0;padding:.75rem .9rem}.mf-search-control input[type=search]::placeholder{color:var(--mf-muted)}.mf-search-control button{border:0;border-left:1px solid var(--mf-accent);background:var(--mf-accent);color:var(--mf-background);cursor:pointer;font:inherit;justify-content:center;align-items:center;gap:.45rem;padding:.75rem 1rem;font-weight:650;transition:filter .12s;display:inline-flex}.mf-search-control button:hover{filter:brightness(.92)}.mf-search-control button:focus-visible{outline:3px solid var(--mf-accent)}@supports (color:color-mix(in lab, red, red)){.mf-search-control button:focus-visible{outline:3px solid color-mix(in srgb, var(--mf-accent) 28%, transparent)}}.mf-search-control button:focus-visible{outline-offset:-4px}.mf-search-page-results{gap:.35rem;margin-top:1.25rem;display:grid}.mf-search-page-results .mf-public-search-result{border-color:var(--mf-border);background:var(--mf-background);color:var(--mf-accent)}.mf-search-page-results .mf-public-search-result:visited{color:var(--mf-accent)}.mf-search-page-results .mf-public-search-result:hover,.mf-search-page-results .mf-public-search-result:focus-visible{background:var(--mf-surface);opacity:1}.mf-search-page-results .mf-public-search-result__details{color:var(--mf-muted);-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:.2rem 0 0;font-size:.84em;font-weight:400;line-height:1.45;display:-webkit-box;overflow:hidden}.mf-search-page-results .mf-public-search-result__details mark{background:var(--mf-accent);border-radius:.2em}@supports (color:color-mix(in lab, red, red)){.mf-search-page-results .mf-public-search-result__details mark{background:color-mix(in srgb, var(--mf-accent) 16%, transparent)}}.mf-search-page-results .mf-public-search-result__details mark{color:inherit;font-weight:650}.mf-rich-content{--mf-rich-block-gap:1rem;line-height:1.6}.mf-rich-content>*{margin-block:0}.mf-rich-content>*+*{margin-top:var(--mf-rich-block-gap)}section{margin-bottom:4em}h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.25em}p,ul,ol{margin-top:0;margin-bottom:.5em}a,a:visited{color:var(--mf-accent);font-weight:500;text-decoration:none}a:hover{opacity:.65}img{max-width:100%}:not(pre)>code{border:1px solid var(--mf-border);background:var(--mf-surface);-webkit-box-decoration-break:clone;box-decoration-break:clone;color:var(--mf-text);overflow-wrap:anywhere;border-radius:.35em;padding:.1em .35em;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-size:.9em}pre{box-sizing:border-box;border:1px solid var(--mf-border);background:var(--mf-surface);tab-size:2;white-space:pre;border-radius:.5em;max-width:100%;margin:1em 0;padding:1em;line-height:1.5;overflow-x:auto}pre code{color:var(--mf-text);overflow-wrap:normal;background:0 0;border:0;padding:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-size:.9em;display:block}.flex{display:flex}.flex-none{flex:none}.flex-1{flex:1}.items-center{align-items:center}.justify-center{justify-content:center}.flex-wrap{flex-wrap:wrap}.px-2{padding-left:.5em;padding-right:.5em}.mb-1{margin-bottom:.25em}.mb-2{margin-bottom:.5em}.mb-4{margin-bottom:1em}.mt-2{margin-top:.5em}.mt-4{margin-top:1em}.ml-1{margin-left:.25em}.mr-4{margin-right:1em}.one-line{-webkit-line-clamp:1;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.text-sm{font-size:.8em}.text-lg{font-size:1.25em}.text-muted{color:var(--mf-muted)}.img-lg{max-width:7.5em;box-shadow:.2em .2em .2em var(--mf-border);border-radius:.8em}.img-md{max-width:3.5em;box-shadow:.1em .1em .1em var(--mf-border);border-radius:.2em}.img-sm{border-radius:.2em;width:1em;max-width:1em;height:1em}.border-t{border-top:1px solid var(--mf-border)}.border-b{border-bottom:1px solid var(--mf-border)}.text-center{text-align:center}.w-full{width:100%}.font-bold{font-weight:700}@media only screen and (width&lt;=600px){html:not(.rss-document){padding-left:1em;padding-right:1em}.hide-mobile{display:none}.mf-site-nav{gap:.6rem}.mf-site-brand{order:1;max-width:6rem;margin-right:auto}.mf-site-brand img{width:1.8rem;height:1.8rem}.mf-site-search{display:none}.mf-search-icon-button{order:2;width:2.5rem;height:2.5rem;padding:0;display:inline-flex}.mf-nav-links{flex:none;order:3}.mf-nav-links>a{display:none}.mf-nav-overflow summary{border:1px solid var(--mf-border);background:var(--mf-background);width:2.5rem;height:2.5rem;color:var(--mf-text);border-radius:.5rem;justify-content:center;padding:0}.mf-nav-overflow-label,.mf-nav-overflow-chevron{display:none}.mf-nav-overflow-menu-icon{display:block}.mf-nav-overflow[open] summary .mf-nav-overflow-menu-icon{transform:none}.mf-theme-menu{order:4}.mf-search-control button{padding-inline:.85rem}.mf-search-control button span{display:none}}.icon-arrow-left:before{content:"←"}.icon-arrow-right:before{content:"→"}@keyframes background-color-palette{0%,to{background:var(--mf-border)}25%,75%{background:color-mix(in srgb, var(--mf-border) 85%, var(--mf-muted))}50%{background:var(--mf-muted)}}.loader{background-color:var(--mf-border);width:100%;height:20em;animation:10s infinite alternate background-color-palette}@media (prefers-reduced-motion:reduce){.loader{animation:none}}html.rss-document{background:var(--mf-text);max-width:none;min-height:100%;margin:0;padding:0}@supports (color:color-mix(in lab, red, red)){html.rss-document{background:color-mix(in srgb, var(--mf-text) 3%, var(--mf-background))}}html.rss-document *{box-sizing:border-box}body.rss-page{background:var(--mf-text);max-width:none;min-height:100dvh;margin:0;padding:1rem;display:block}@supports (color:color-mix(in lab, red, red)){body.rss-page{background:color-mix(in srgb, var(--mf-text) 3%, var(--mf-background))}}body.rss-page{color:var(--mf-text)}@supports (color:color-mix(in lab, red, red)){body.rss-page{color:color-mix(in srgb, var(--mf-text) 80%, transparent)}}body.rss-page{font-size:.75rem;line-height:1.7}.rss-page .rss-container{border:1px solid var(--mf-text);flex-direction:column;max-width:50rem;min-height:calc(100dvh - 2rem);padding:1.875rem;display:flex}@supports (color:color-mix(in lab, red, red)){.rss-page .rss-container{border:1px solid color-mix(in srgb, var(--mf-text) 10%, transparent)}}.rss-page .rss-container{background:var(--mf-background);box-shadow:0 .125rem .1875rem var(--mf-text);border-radius:.5rem;margin:0 auto}@supports (color:color-mix(in lab, red, red)){.rss-page .rss-container{box-shadow:0 .125rem .1875rem color-mix(in srgb, var(--mf-text) 10%, transparent)}}.rss-page .rss-content{flex:1 0 auto}.rss-page section{margin-bottom:0}.rss-page .podcast-header{margin-bottom:1.25rem}.rss-page .podcast-header-image-title{display:flex}.rss-page .podcast-image{margin-bottom:1.25rem;margin-right:1.25rem}.rss-page .podcast-image img{border:1px solid var(--mf-text);width:12.5rem;height:auto}@supports (color:color-mix(in lab, red, red)){.rss-page .podcast-image img{border:1px solid color-mix(in srgb, var(--mf-text) 10%, transparent)}}.rss-page .podcast-image img{box-shadow:0 0 1.25rem var(--mf-text);border-radius:.25rem}@supports (color:color-mix(in lab, red, red)){.rss-page .podcast-image img{box-shadow:0 0 1.25rem color-mix(in srgb, var(--mf-text) 10%, transparent)}}.rss-page .podcast-author,.rss-page .episode-time{color:var(--mf-muted)}.rss-page .category-container{margin-bottom:1rem;font-size:.75rem}.rss-page .category-item{border:1px solid var(--mf-muted);background:var(--mf-muted);color:var(--mf-background);border-radius:.25rem;margin:.25rem;padding:.25rem;display:inline-block}.rss-page .item{clear:both;border-top:1px solid var(--mf-text);padding:1.5rem 0}@supports (color:color-mix(in lab, red, red)){.rss-page .item{border-top:1px solid color-mix(in srgb, var(--mf-text) 10%, transparent)}}.rss-page .item h2,.rss-page .item p,.rss-page .item a{line-height:1.7}.rss-page .episode-image img{border-radius:.3125rem;width:6.25rem;height:auto;margin:0 1.875rem .9375rem 0}.rss-page audio,.rss-page video{border-radius:.25rem;width:100%}.rss-page .enclosure-link{margin-top:.75rem;display:inline-block}.rss-page .pagination{border-top:1px solid var(--mf-text);justify-content:center;padding-top:2.5rem;display:flex}@supports (color:color-mix(in lab, red, red)){.rss-page .pagination{border-top:1px solid color-mix(in srgb, var(--mf-text) 10%, transparent)}}.rss-page .pagination a{border:1px solid var(--mf-accent);border-radius:.25rem;margin:0 .5rem;padding:0 1rem}.rss-page footer{color:var(--mf-muted);text-align:center;border-top:0;flex:none;margin-top:5rem;padding-top:1rem}@media only screen and (width&lt;=600px){body.rss-page{padding:.5rem}.rss-page .rss-container{min-height:calc(100dvh - 1rem);padding:1rem}.rss-page .podcast-header-image-title{display:block}.rss-page .podcast-image{margin-right:0}.rss-page .podcast-image img{width:9rem}}.mf-contact{border-top:1px solid var(--mf-border);margin-top:2.5rem;padding-top:1.5rem}.mf-contact h2{margin-bottom:.75rem;font-size:1.25rem;font-weight:600}.mf-contact-success{border:1px solid var(--mf-border);background:var(--mf-surface);color:var(--mf-text);border-radius:.5rem;padding:.75rem 1rem}.mf-contact-form{gap:.75rem;display:grid}.mf-contact-field{color:var(--mf-muted);gap:.25rem;font-size:.875rem;display:grid}.mf-contact-field input,.mf-contact-field textarea{box-sizing:border-box;border:1px solid var(--mf-border);background:var(--mf-background);width:100%;color:var(--mf-text);font:inherit;border-radius:.5rem;padding:.5rem .75rem}.mf-contact-field input:focus,.mf-contact-field textarea:focus{outline:2px solid var(--mf-accent)}@supports (color:color-mix(in lab, red, red)){.mf-contact-field input:focus,.mf-contact-field textarea:focus{outline:2px solid color-mix(in srgb, var(--mf-accent) 50%, transparent)}}.mf-contact-field input:focus,.mf-contact-field textarea:focus{outline-offset:1px}.mf-contact-submit{border:1px solid var(--mf-accent);background:var(--mf-accent);color:#fff;font:inherit;cursor:pointer;border-radius:.5rem;justify-self:start;padding:.5rem 1.25rem;font-weight:600}.mf-contact-submit:hover{filter:brightness(.95)}@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}@property --tw-font-weight{syntax:"*";inherits:false}@property --tw-outline-style{syntax:"*";inherits:false;initial-value:solid}
/*$vite$:1*/
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
              Powered by <a class="mf-footer-link" href="https://www.microfeed.org/">microfeed</a>
              (a <a class="mf-footer-link" href="https://www.listennotes.com/">Listen Notes</a> project)
            </div>
          </footer>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
