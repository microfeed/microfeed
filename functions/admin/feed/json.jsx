export async function onRequestGet({data}) {
  const {feedContent} = data;
  return new Response(JSON.stringify(feedContent), {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
  });
}
