import {onGetR2PresignedUrlRequestPost} from "../../../edge-src/EdgeCommonRequests";

export async function onRequestPost(context) {
  return await onGetR2PresignedUrlRequestPost(context);
}
