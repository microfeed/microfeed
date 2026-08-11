function inlineScriptValue(value: string): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function themeRssPreviewDocument(
  rss: string,
  stylesheet: string,
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>RSS preview</title>
  </head>
  <body>
    <p id="theme-rss-preview-status">Rendering RSS preview…</p>
    <script>
      try {
        const parser = new DOMParser();
        const rss = parser.parseFromString(${inlineScriptValue(rss)}, "application/xml");
        const stylesheet = parser.parseFromString(${inlineScriptValue(stylesheet)}, "application/xml");
        const parseError = rss.querySelector("parsererror") || stylesheet.querySelector("parsererror");
        if (parseError) throw new Error(parseError.textContent || "Invalid RSS or XSL.");
        const processor = new XSLTProcessor();
        processor.importStylesheet(stylesheet);
        const rendered = processor.transformToDocument(rss);
        const root = document.importNode(rendered.documentElement, true);
        document.documentElement.replaceWith(root);
        for (const original of [...document.scripts]) {
          const executable = document.createElement("script");
          for (const attribute of original.attributes) executable.setAttribute(attribute.name, attribute.value);
          executable.textContent = original.textContent;
          original.replaceWith(executable);
        }
      } catch (error) {
        const status = document.getElementById("theme-rss-preview-status");
        const message = "RSS preview could not be rendered: " +
          (error instanceof Error ? error.message : String(error));
        if (status) status.textContent = message;
        else if (document.body) document.body.textContent = message;
      }
    </script>
  </body>
</html>`;
}
