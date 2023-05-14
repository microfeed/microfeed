import OpenAPIYaml from '../../../edge-src/EdgeApiApp/openapi.yaml.html';

const Mustache = require('mustache');

export async function onRequestGet({request}) {
  const urlObj = new URL(request.url);
  const baseUrl = urlObj.origin;
  const html = Mustache.render(OpenAPIYaml, {baseUrl});

  return new Response(html, {
    headers: {
      'content-type': 'text/yaml; charset=utf-8',
    },
  });
}

export function onRequestHead() {
  return new Response('ok');
}
