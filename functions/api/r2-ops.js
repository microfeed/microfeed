import * as AWS from 'aws-sdk';

async function _getPresignedUrl(accessKeyId, secretAccessKey, endpoint, region, bucket, key) {
  const s3 = new AWS.S3({
    region,
    signatureVersion: 'v4',
    credentials: new AWS.Credentials(accessKeyId, secretAccessKey),
    endpoint: new AWS.Endpoint(endpoint),
  });

  return s3.getSignedUrl('putObject', {
    Bucket: bucket,
    Key: key,
    Expires: 300
  });
}

async function getPresignedUrlFromR2(env, bucket, key) {
  const accessKeyId = `${env.ACCESS_KEY_ID}`
  const secretAccessKey = `${env.SECRET_ACCESS_KEY}`;
  const endpoint = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com`;
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
