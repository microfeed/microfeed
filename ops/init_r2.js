/*
  Set CORS rules for a bucket, so we can use presigned_url to upload files from browser js.
 */
const AWS = require('aws-sdk');

const {VarsReader} = require('./lib/utils');

class SetupR2 {
  constructor() {
    const currentEnv = process.env.DEPLOYMENT_ENVIRONMENT || 'production';
    this.v = new VarsReader(currentEnv);
    this.endpoint = `https://${this.v.get('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`;
    this.s3 = new AWS.S3({
      region: 'auto',
      signatureVersion: 'v4',
      credentials: new AWS.Credentials(this.v.get('R2_ACCESS_KEY_ID'), this.v.get('R2_SECRET_ACCESS_KEY')),
      endpoint: new AWS.Endpoint(this.endpoint),
    });
  }

  setupBucket(onDone) {
    const bucket = this.v.get('R2_PUBLIC_BUCKET');
    const bucketParams = {
      Bucket: bucket,
      // XXX: Not implemented yet on Cloudflare side - https://developers.cloudflare.com/r2/data-access/s3-api/api/
      // ACL: 'public-read',
    };

    this.s3.createBucket(bucketParams, function (err, data) {
      if (err) {
        if (err.code === 'BucketAlreadyOwnedByYou') {
          console.log(`Bucket exists: ${bucket}`);
        } else {
          console.log("Error", err);
          process.exit(1);
        }
      } else {
        console.log("Success", data.Location);
      }
      onDone();
    });
  }

  setupCorsRules() {
    const params = {
      Bucket: this.v.get('R2_PUBLIC_BUCKET'),
      CORSConfiguration: {
        CORSRules: [{
          AllowedMethods: ['DELETE', 'POST', 'PUT'],
          AllowedOrigins: ['*'],
          AllowedHeaders: ['*'],
        }]
      }
    };

    console.log(`Setting up CORS rules for ${this.v.get('R2_PUBLIC_BUCKET')}...`)
    this.s3.putBucketCors(params, (err, data) => {
      if (err) {
        console.log(err);
        process.exit(1);
      } else {
        console.log('Success!', data);
        console.log(params.CORSConfiguration.CORSRules);
      }
    });
  }
}

const setupR2 = new SetupR2();
setupR2.setupBucket(() => {
  setupR2.setupCorsRules();
});
