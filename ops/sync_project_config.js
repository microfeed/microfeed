const https = require('https');

const {VarsReader} = require('./lib/utils');

const ALLOWED_VARS = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_PROJECT_NAME',
  'DEPLOYMENT_ENVIRONMENT',

  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'MEDIA_BASE_URL',

  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',

  "NODE_VERSION",
  'FEEDKIT_VERSION',
];

class SyncProjectConfig {
  constructor() {
    this.currentEnv = process.env.DEPLOYMENT_ENVIRONMENT || 'production';
    this.v = new VarsReader(this.currentEnv);
  }

  _getEnvVarsFromFilesJson(envName) {
    const envVarsJson = {
      [envName]: {
        'env_vars': {},
        'r2_buckets': {
          'LH_DATABASE': {
            name: this.v.get('R2_BUCKET')
          },
        },
      }
    };
    ALLOWED_VARS.forEach((varName) => {
      const varValue = this.v.get(varName) || '';
      envVarsJson[envName]['env_vars'][varName] = {
        value: varValue,
      };
    });
    return envVarsJson;
  }

  _updateEnvVars(data, onSuccess) {
    const options = {
      hostname: 'api.cloudflare.com',
      port: 443,
      path: `/client/v4/accounts/${this.v.get('CLOUDFLARE_ACCOUNT_ID')}/pages/projects/${this.v.get('CLOUDFLARE_PROJECT_NAME')}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.v.get('CLOUDFLARE_API_TOKEN')}`,
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
          process.exit(1);
        }
      });
    });

    req.on('error', (e) => {
      console.error(e);
      process.exit(1);
    });
    req.write(data)
    req.end();
  }

  syncEnvVars() {
    console.log(`Sync-ing for [${this.currentEnv}]...`);

    const varsToAddOrUpdate = JSON.stringify({
      'deployment_configs': {
        ...this._getEnvVarsFromFilesJson(this.currentEnv),
      },
    });

    this._updateEnvVars(varsToAddOrUpdate, (json) => {
      console.log(`Successfully synced for [${this.currentEnv}]!`);
      console.log(Object.keys(json.result.deployment_configs[this.currentEnv].env_vars));
    });
  }
}

const syncProjectConfig = new SyncProjectConfig();
syncProjectConfig.syncEnvVars();
