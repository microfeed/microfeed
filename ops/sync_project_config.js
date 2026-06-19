const https = require('https');
const {VarsReader, WranglerCmd} = require('./lib/utils');

const ALLOWED_VARS = [
  {name: 'CLOUDFLARE_ACCOUNT_ID', encrypted: true, required: true},
  {name: 'CLOUDFLARE_PROJECT_NAME', encrypted: true, required: true},
  {name: 'CLOUDFLARE_API_TOKEN', encrypted: true, required: true},
  {name: 'DEPLOYMENT_ENVIRONMENT', encrypted: false, required: false},

  {name: 'R2_ACCESS_KEY_ID', encrypted: true, required: true},
  {name: 'R2_SECRET_ACCESS_KEY', encrypted: true, required: true},
  {name: 'R2_PUBLIC_BUCKET', encrypted: true, required: false},

  {name: 'D1_DATABASE_NAME', encrypted: true, required: false},

  {name: 'NODE_VERSION', encrypted: false, required: false},  // Cloudflare Pages CI needs this to use the right Node version.
  {name: 'MICROFEED_VERSION', encrypted: false, required: false},
];

class SyncProjectConfig {
  constructor() {
    this.currentEnv = process.env.DEPLOYMENT_ENVIRONMENT || 'production';
    this.v = new VarsReader(this.currentEnv);
    this.cmd = new WranglerCmd(this.currentEnv);
  }

  _getVarValue(varName, defaultValue = null) {
    return process.env[varName] || this.v.get(varName, defaultValue);
  }

  _buildDeploymentConfig(envName, databaseId) {
    const deploymentConfig = {
      env_vars: {},
    };

    if (databaseId) {
      deploymentConfig.d1_databases = {
        FEED_DB: {
          id: databaseId,
        },
      };
    }

    const bucketName = this._getVarValue('R2_PUBLIC_BUCKET');
    if (bucketName) {
      deploymentConfig.r2_buckets = {
        R2_BUCKET: {
          name: bucketName,
        },
      };
    }

    ALLOWED_VARS.forEach((varDict) => {
      const varValue = this._getVarValue(varDict.name);
      if (!varValue) {
        return;
      }
      deploymentConfig.env_vars[varDict.name] = {
        'value': varValue,
        'type': varDict.encrypted ? 'secret_text' : 'plain_text',
      };
    });

    return {
      [envName]: deploymentConfig,
    };
  }

  _getCurrentProject(onSuccess) {
    const options = {
      hostname: 'api.cloudflare.com',
      port: 443,
      path: `/client/v4/accounts/${this._getVarValue('CLOUDFLARE_ACCOUNT_ID')}/pages/projects/${this._getVarValue('CLOUDFLARE_PROJECT_NAME')}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this._getVarValue('CLOUDFLARE_API_TOKEN')}`,
        'Content-Type': 'application/json',
      },
    };

    https.get(options, (res) => {
      let body = '';
      res.on('data', (d) => {
        body += d;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          onSuccess(json);
        } catch (error) {
          console.error(error.message);
          process.exit(1);
        }
      });
    }).on('error', (e) => {
      console.error(e);
      process.exit(1);
    });
  }

  _updateEnvVars(data, onSuccess) {
    const options = {
      hostname: 'api.cloudflare.com',
      port: 443,
      path: `/client/v4/accounts/${this._getVarValue('CLOUDFLARE_ACCOUNT_ID')}/pages/projects/${this._getVarValue('CLOUDFLARE_PROJECT_NAME')}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this._getVarValue('CLOUDFLARE_API_TOKEN')}`,
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

    // ensure that required vars are set
    let missingVars = [];
    ALLOWED_VARS.forEach((varDict) => {
      if (varDict.required && !this._getVarValue(varDict.name)) {
        missingVars.push(varDict.name);
      }
    });
    if (missingVars.length > 0) {
      console.error(`Missing required vars: ${missingVars.join(', ')}`);
      process.exit(1);
    }
    // ensure that the project name is valid
    if (!this._getVarValue('CLOUDFLARE_PROJECT_NAME').match(/^[a-zA-Z0-9-]+$/)) {
      console.error(`Invalid project name: ${this._getVarValue('CLOUDFLARE_PROJECT_NAME')}`);
      process.exit(1);
    }


    this.cmd.getDatabaseId((databaseId) => {
      console.log('Database id (num of chars): ', databaseId.length)
      this._getCurrentProject((projectJson) => {
        const existingDeploymentConfigs = projectJson?.result?.deployment_configs || {};
        const currentConfig = existingDeploymentConfigs[this.currentEnv] || {};
        const nextConfig = {
          ...currentConfig,
          ...this._buildDeploymentConfig(this.currentEnv, databaseId)[this.currentEnv],
        };
        const varsToAddOrUpdate = JSON.stringify({
          'deployment_configs': {
            ...existingDeploymentConfigs,
            [this.currentEnv]: nextConfig,
          },
        });

        this._updateEnvVars(varsToAddOrUpdate, (json) => {
          console.log(`Successfully synced for [${this.currentEnv}]!`);
          if (json.result && json.result.deployment_configs) {
            const syncedConfig = json.result.deployment_configs[this.currentEnv];
            const envVarKeys = Object.keys(syncedConfig.env_vars || {});
            const d1Keys = Object.keys(syncedConfig.d1_databases || {});
            const r2Keys = Object.keys(syncedConfig.r2_buckets || {});
            console.log({
              envVarKeys,
              d1Bindings: d1Keys,
              r2Bindings: r2Keys,
            });
          } else if (json) {
            console.log(json);
          }
        });
      });
    });
  }
}

const syncProjectConfig = new SyncProjectConfig();
syncProjectConfig.syncEnvVars();
