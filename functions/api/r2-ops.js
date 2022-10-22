import { AwsClient } from 'aws4fetch'

async function _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, region, bucket, key) {

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    'region': 'auto',
  });

  const request = new Request(endpoint, {
    method: 'PUT',
  });

  const presigned = await aws.sign(request, { aws: { signQuery: true }})
  return presigned.url;
}

async function getPresignedUrlFromR2(env, bucket, key) {
  const accessKeyId = `${env.ACCESS_KEY_ID}`
  const secretAccessKey = `${env.SECRET_ACCESS_KEY}`;
  const endpoint = `https://${bucket}.${env.ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
  return _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, 'auto', bucket, key);
}

async function getPresignedUrlFromS3(env, bucket, key) {
  const accessKeyId = `${env.AWS_ACCESS_KEY_ID}`
  const secretAccessKey = `${env.AWS_SECRET_ACCESS_KEY}`;
  const region = 'us-west-2';
  const endpoint = `https://s3.${region}.amazonaws.com`;
  return _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, region, bucket, key);
}

export async function onRequestPost({request, env}) {
  const inputParams = await request.json();
  const url = await getPresignedUrlFromR2(env, 'tmp-files', inputParams.name);

  // const url = await getPresignedUrlFromS3(env, 'temp-data-listennotes-com', inputParams.name);
  const retData = {
    url,
  }
  return new Response(JSON.stringify(retData), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
