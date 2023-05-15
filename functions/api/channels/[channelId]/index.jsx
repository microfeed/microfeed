export async function onRequestPut({ params, request, data }) {
  const {channelId} = params;

  let response = {};
  let status = 200;
  if (channelId !== 'primary') {
    status = 400;
    response = {error: 'Invalid channel id'};
  } else {
    const channelJson = await request.json();
    const { feedCrud } = data;
    feedCrud.upsertChannel(channelJson);
  }

  return new Response(JSON.stringify(response), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
    status,
  });
}
