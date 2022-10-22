import { AwsClient } from 'aws4fetch'

async function _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, region, size, type) {
  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    'service': 's3',
    region,
  });

  const request = new Request(endpoint, {
    method: 'PUT',
    // headers: {
    //   'Content-Type': type,
    // },
  });

  const presigned = await aws.sign(request, { aws: { signQuery: true }})
  return presigned.url;
}

async function getPresignedUrlFromR2(env, bucket, inputParams) {
  const { key, size, type } = inputParams;
  const accessKeyId = `${env.ACCESS_KEY_ID}`
  const secretAccessKey = `${env.SECRET_ACCESS_KEY}`;
  const endpoint = `https://${bucket}.${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  return _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, 'auto', size, type);
}

/*
  const url = await getPresignedUrlFromS3(env, env.AWS_BUCKET, inputParams.name);
 */
// async function getPresignedUrlFromS3(env, bucket, key) {
//   const accessKeyId = `${env.AWS_ACCESS_KEY_ID}`
//   const secretAccessKey = `${env.AWS_SECRET_ACCESS_KEY}`;
//   const region = 'us-west-2';
//   const endpoint = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
//   return _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, region);
// }

export async function onRequestPost({request, env}) {
  const inputParams = await request.json();
  const url = await getPresignedUrlFromR2(env, env.BUCKET, inputParams);

  const retData = {
    url,
  }
  return new Response(JSON.stringify(retData), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
