// TODO: update channel info
export async function onRequestPut() {
  return new Response(JSON.stringify({}), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
