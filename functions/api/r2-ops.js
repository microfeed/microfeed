import * as AWS from 'aws-sdk';

export async function onRequestPost({request, env}) {
  const inputParams = await request.json();
  const accessKeyId = `${env.ACCESS_KEY_ID}`
  const secretAccessKey = `${env.SECRET_ACCESS_KEY}`;
  const endpoint = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com`;

  const s3 = new AWS.S3({
    region: "auto",
    signatureVersion: 'v4',
    credentials: new AWS.Credentials(accessKeyId, secretAccessKey),
    endpoint: new AWS.Endpoint(endpoint),
  });

  const url = s3.getSignedUrl('putObject', {
    Bucket: 'tmp-files',
    Key: inputParams.name,
    Expires: 300
  });

  const retData = {
    url,
  }
  return new Response(JSON.stringify(retData), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
