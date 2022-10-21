import { AwsClient } from 'aws4fetch'

export async function onRequestPost({request, env}) {
  const inputParams = await request.json();
  console.log(inputParams);
  const accessKeyId = `${env.ACCESS_KEY_ID}`
  const secretAccessKey = `${env.SECRET_ACCESS_KEY}`;
  const endpoint = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });

  // const ListBucketsResult = await aws.fetch(endpoint);
  // console.log(await ListBucketsResult.text());

  // const ListObjectsV2Result = await aws.fetch(`${endpoint}/tmp-files?list-type=2`)
  // console.log(await ListObjectsV2Result.text())

  const retData = {}
  return new Response(JSON.stringify(retData), {
    headers: {
      'content-type': 'application/json;charset=UTF-8',
    },
  });
}
