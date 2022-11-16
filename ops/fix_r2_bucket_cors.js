/*
  Set CORS rules for a bucket, so we can use presigned_url to upload files from browser js.
 */
const fs = require('fs');
const AWS = require('aws-sdk');
const dotenv = require('dotenv')

const buffer = fs.readFileSync('.dev.vars');
const env = dotenv.parse(buffer);

const endpoint = `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com`;

const s3 = new AWS.S3({
  region: 'auto',
  signatureVersion: 'v4',
  credentials: new AWS.Credentials(env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY),
  endpoint: new AWS.Endpoint(endpoint),
});

const params = {
  Bucket: env.R2_BUCKET,
  CORSConfiguration: {
    CORSRules: [{
      AllowedMethods: ['DELETE', 'POST', 'PUT'],
      AllowedOrigins: ['*'],
      AllowedHeaders: ['*'],
    }]
  }
};

s3.putBucketCors(params, (err, data) => {
  if (err) {
    console.log(err);
    process.exit(1);
  } else {
    console.log('Success!');
    console.log(data);
  }
});
