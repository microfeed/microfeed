const fs = require('fs');
const dotenv = require('dotenv')
const https = require('https');

const buffer = fs.readFileSync('.dev.vars');
const env = dotenv.parse(buffer);

const ALLOWED_VARS = [
  'ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'MEDIA_BASE_URL',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
];

const data = JSON.stringify({
  'deployment_configs': {
    'preview': {
      'env_vars': {
        'ADMIN_USERNAME': {'value': env.ADMIN_USERNAME},
      }
    }
  }
});

const options = {
  hostname: 'api.cloudflare.com',
  port: 443,
  path: `/client/v4/accounts/${env.ACCOUNT_ID}/pages/projects/${env.PROJECT_NAME}`,
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${env.PAGES_SECRET_ACCESS_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = https.request(options, (res) => {
  console.log('statusCode:', res.statusCode);
  console.log('headers:', res.headers);

  res.on('data', (d) => {
    // TODO: Check output and delete all environment variables that are NOT in ALLOWED_VARS
    // env_var: null
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.write(data)
req.end();
