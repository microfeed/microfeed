export async function onRequestGet({request}) {
  const url = new URL(request.url);
  url.pathname = '/json/openapi.html';
  return Response.redirect(url.toString(), 302);
}

export function onRequestHead() {
  return new Response('ok');
}
