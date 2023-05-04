// TODO: get r2 presigned url
export async function onRequestPost() {
  return new Response(JSON.stringify({}), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
