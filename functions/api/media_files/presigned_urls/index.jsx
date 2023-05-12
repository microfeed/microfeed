import {onGetR2PresignedUrlRequestPost} from "../../../../edge-src/EdgeCommonRequests";

export async function onRequestPost(context) {
  // TODO: for input, add logic to construct R2 object key
  // TODO: for response, construct full cdn url
  return await onGetR2PresignedUrlRequestPost(context);
}
