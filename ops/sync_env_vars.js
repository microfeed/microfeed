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
  "NODE_VERSION",
];

const getEnvVarsFromFilesJson = (envName) => {
  const bufferForEnv = fs.readFileSync(`.${envName}.vars`);
  const envJson = dotenv.parse(bufferForEnv);

  const envVarsJson = {
    [envName]: {
      'env_vars': {},
    }
  };
  ALLOWED_VARS.forEach((varName) => {
    const varValue = envJson[varName] || env[varName];
    envVarsJson[envName]['env_vars'][varName] = {
      value: varValue,
    };
  });
  return envVarsJson;
};

const updateEnvVars = (data, onSuccess) => {

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
    // console.log('statusCode:', res.statusCode);
    // console.log('headers:', res.headers);
    let body = '';
    res.on('data', (d) => {
      // d.result.deployment_configs.preview
      // d.result.deployment_configs.production
      // process.stdout.write(d);
      // onSuccess(d);
      body += d;
    });
    res.on("end", () => {
      try {
        let json = JSON.parse(body);
        onSuccess(json);
      } catch (error) {
        console.error(error.message);
      }
    });
  });

  req.on('error', (e) => {
    console.error(e);
  });
  req.write(data)
  req.end();
};

const varsToAddOrUpdate = JSON.stringify({
  'deployment_configs': {
    ...getEnvVarsFromFilesJson('preview'),
    ...getEnvVarsFromFilesJson('production'),
  }
});

updateEnvVars(varsToAddOrUpdate, () => {
  console.log('Updated successfully!');
});
