const https = require('https');

const {VarsReader} = require('./lib/utils');

const ALLOWED_VARS = [
  {name: 'CLOUDFLARE_ACCOUNT_ID', encrypted: true},
  {name: 'CLOUDFLARE_PROJECT_NAME', encrypted: true},
  {name: 'CLOUDFLARE_API_TOKEN', encrypted: true},
  {name: 'DEPLOYMENT_ENVIRONMENT', encrypted: false},

  {name: 'R2_ACCESS_KEY_ID', encrypted: true},
  {name: 'R2_SECRET_ACCESS_KEY', encrypted: true},
  {name: 'R2_PUBLIC_BUCKET', encrypted: true},
  {name: 'MEDIA_BASE_URL', encrypted: false},

  {name: 'ADMIN_USERNAME', encrypted: true},
  {name: 'ADMIN_PASSWORD', encrypted: true},

  {name: 'NODE_VERSION', encrypted: false},  // Cloudflare Pages CI needs this to use the right Node version.
  {name: 'MICROFEED_VERSION', encrypted: false},
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
            name: this.v.get('R2_PRIVATE_BUCKET')
          },
        },
      }
    };
    ALLOWED_VARS.forEach((varDict) => {
      const varValue = this.v.get(varDict.name) || '';
      envVarsJson[envName]['env_vars'][varDict.name] = {
        'value': varValue,
        'type': varDict.encrypted ? 'secret_text' : 'plain_text',
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
      console.log(json.result.deployment_configs[this.currentEnv].env_vars);
    });
  }
}

const syncProjectConfig = new SyncProjectConfig();
syncProjectConfig.syncEnvVars();
