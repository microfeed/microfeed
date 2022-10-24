const fs = require('fs');
const dotenv = require('dotenv')
const https = require('https');

const buffer = fs.readFileSync('.dev.vars');
const env = dotenv.parse(buffer);

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
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.write(data)
req.end();
