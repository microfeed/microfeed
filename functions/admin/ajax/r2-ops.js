import {onGetR2PresignedUrlRequestPost} from "../../../edge-src/EdgeCommonRequests";

export async function onRequestPost({request, env}) {
  const inputParams = await request.json();
  const jsonData = await onGetR2PresignedUrlRequestPost({inputParams, env});
  return new Response(JSON.stringify(jsonData), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
