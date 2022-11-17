/*
  Set CORS rules for a bucket, so we can use presigned_url to upload files from browser js.
 */
const AWS = require('aws-sdk');

const {VarsReader} = require('./lib/utils');

const currentEnv = process.env.DEPLOYMENT_ENVIRONMENT || 'production';
const v = new VarsReader(currentEnv);

const endpoint = `https://${v.get('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`;

const s3 = new AWS.S3({
  region: 'auto',
  signatureVersion: 'v4',
  credentials: new AWS.Credentials(v.get('R2_ACCESS_KEY_ID'), v.get('R2_SECRET_ACCESS_KEY')),
  endpoint: new AWS.Endpoint(endpoint),
});

const params = {
  Bucket: v.get('R2_BUCKET'),
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
