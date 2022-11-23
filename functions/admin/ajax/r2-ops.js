import { AwsClient } from 'aws4fetch'
import {projectPrefix} from "../../../common-src/R2Utils";

async function _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, region) {
  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    'service': 's3',
    region,
  });

  const request = new Request(endpoint, {
    method: 'PUT',
  });

  const presigned = await aws.sign(request, { aws: { signQuery: true }})
  return presigned.url;
}

async function getPresignedUrlFromR2(env, bucket, inputParams) {
  const {
    key,
    // size,
    // type,
  } = inputParams;
  const accessKeyId = `${env.R2_ACCESS_KEY_ID}`
  const secretAccessKey = `${env.R2_SECRET_ACCESS_KEY}`;
  const endpoint = `https://${bucket}.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${projectPrefix(env)}/${key}`;
  return _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, 'auto');
}

export async function onRequestPost({request, env}) {
  const inputParams = await request.json();
  const presignedUrl = await getPresignedUrlFromR2(env, env.R2_PUBLIC_BUCKET, inputParams);
  const jsonData = {
    presignedUrl,
    mediaBaseUrl: projectPrefix(env),
  };
  return new Response(JSON.stringify(jsonData), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
