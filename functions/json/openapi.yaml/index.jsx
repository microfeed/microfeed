import {buildOpenApiSpec} from "../../../edge-src/models/OpenApiBuilder";
import {MICROFEED_VERSION} from "../../../common-src/Version";

export async function onRequestGet({request}) {
  const baseUrl = new URL(request.url).origin;
  const spec = buildOpenApiSpec({baseUrl, version: MICROFEED_VERSION});

  return new Response(JSON.stringify(spec), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

export function onRequestHead() {
  return new Response('ok');
}
