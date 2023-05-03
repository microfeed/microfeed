export async function onRequestPost() {
  return new Response('response: POST /api/items/');
}

export async function onRequestGet() {
  return new Response('response: GET /api/items/');
}

export async function onRequestDelete() {
  return new Response('response: DELETE /api/items/');
}

export async function onRequestPut() {
  return new Response('response: PUT /api/items/');
}
