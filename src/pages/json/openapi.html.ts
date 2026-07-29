import type {APIRoute} from "astro";

const html = `<!doctype html>
<html lang="en">
  <head>
    <title>microfeed API: headless and serverless CMS on Cloudflare</title>
    <meta name="description" content="HTML version of the microfeed OpenAPI specification.">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url="/json/openapi.yaml"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;

export const GET: APIRoute = () => new Response(html, {
  headers: {"content-type": "text/html; charset=utf-8"},
});

export const HEAD: APIRoute = () => new Response(null, {
  headers: {"content-type": "text/html; charset=utf-8"},
});
