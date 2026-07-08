import React from "react";

// Renders Open Graph, Twitter Card, article:*, keywords, and robots meta
// tags from a PageSeo object (see buildSeo.js). Pure presentation - all
// fallback/derivation logic lives in buildSeo so this component only reads
// the already-resolved seo fields.
export default function MetaTags({seo}) {
  if (!seo) {
    return null;
  }

  const {
    title,
    description,
    canonicalUrl,
    ogType,
    image,
    siteName,
    twitterHandle,
    keywords,
    noindex,
    publishedTime,
    modifiedTime,
    author,
    section,
    tags,
  } = seo;

  const isArticle = ogType === "article";

  return (
    <>
      {/* Open Graph */}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      {ogType && <meta property="og:type" content={ogType} />}
      {siteName && <meta property="og:site_name" content={siteName} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      {twitterHandle && <meta name="twitter:site" content={twitterHandle} />}
      {twitterHandle && <meta name="twitter:creator" content={twitterHandle} />}
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}

      {/* article:* (blog_article / podcast_episode) */}
      {isArticle && publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {isArticle && modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {isArticle && author && <meta property="article:author" content={author} />}
      {isArticle && section && <meta property="article:section" content={section} />}
      {isArticle && (tags || []).map((tag) => <meta key={tag} property="article:tag" content={tag} />)}

      {/* Keywords + robots */}
      {keywords && keywords.length > 0 && <meta name="keywords" content={keywords.join(", ")} />}
      <meta name="robots" content={noindex ? "noindex,nofollow" : "index,follow"} />
    </>
  );
}
