const fs = require('fs');
const toml = require('toml');
const https = require('https');

class VarsReader {
  constructor(currentEnv, varsFilePath = '.vars.toml') {
    const varsBuffer = fs.readFileSync(varsFilePath);
    this.data = toml.parse(varsBuffer);
    this.currentEnv = currentEnv;
  }

  get(key, defaultValue = null) {
    const envDict = this.data[this.currentEnv] || {};
    return envDict[key] || this.data[key] || defaultValue;
  }

  flattenVars() {
    const varDict = {};
    const keys = Object.keys(this.data).filter((k) => !['production', 'preview', 'development'].includes(k))
    keys.forEach((k) => {
      varDict[k] = this.get(k, '');
    });
    return varDict;
  }
}

class WranglerCmd {
  constructor(currentEnv) {
    this.currentEnv = currentEnv;
    this.v = new VarsReader(currentEnv);
  }

  _getCmd(wranglerCmd) {
    return `CLOUDFLARE_ACCOUNT_ID=${this.v.get('CLOUDFLARE_ACCOUNT_ID')} ` +
      `CLOUDFLARE_API_TOKEN=${this.v.get('CLOUDFLARE_API_TOKEN')} ` + wranglerCmd;
  }

  publishProject() {
    const projectName = this.v.get('CLOUDFLARE_PROJECT_NAME');
    const productionBranch = this.v.get('PRODUCTION_BRANCH', 'main');

    // Cloudflare Pages direct upload uses branch to decide deployment environment.
    // If we want production, then use production_branch. Otherwise, just something else
    const branch = this.currentEnv === 'production' ? productionBranch : `${productionBranch}-preview`;
    const wranglerCmd = `wrangler pages publish public --project-name ${projectName} --branch ${branch}`;
    console.log(wranglerCmd);
    return this._getCmd(wranglerCmd);
  }

  _non_dev_db() {
    return `${this.v.get('CLOUDFLARE_PROJECT_NAME')}_feed_db_${this.currentEnv}`;
  }

  createFeedDb() {
    const wranglerCmd = this.currentEnv !== 'development' ?
      `wrangler d1 create ${this._non_dev_db()}` : 'echo "FEED_DB"';
    console.log(wranglerCmd);
    return this._getCmd(wranglerCmd);
  }

  createFeedDbTables() {
    const dbName = this.currentEnv !== 'development' ? this._non_dev_db() : 'FEED_DB --local';
    const wranglerCmd = `wrangler d1 execute ${dbName} --file ops/db/init.sql`;
    console.log(wranglerCmd);
    return this._getCmd(wranglerCmd);
  }

  /**
   * XXX: We use private api here, which may be changed on the cloudflare end...
   * https://github.com/cloudflare/wrangler2/blob/main/packages/wrangler/src/d1/list.tsx#L34
   */
  getDatabaseId(onSuccess) {
    const dbName = this.currentEnv !== 'development' ? this._non_dev_db() : 'FEED_DB';
    const accountId = this.v.get('CLOUDFLARE_ACCOUNT_ID');
    const apiKey = this.v.get('CLOUDFLARE_API_TOKEN');
    const options = {
      host: 'api.cloudflare.com',
      port: '443',
      path: `/client/v4/accounts/${accountId}/d1/database?name=${dbName}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    };
    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data = data + chunk.toString();
      });

      response.on('end', () => {
        const body = JSON.parse(data);
        let databaseId = '';
        body.result.forEach((result) => {
          if (result.name === dbName) {
            databaseId = result.uuid;
          }
        });
        onSuccess(databaseId);
      });
    })

    request.on('error', (error) => {
      console.log('An error', error);
      onSuccess('');
    });

    request.end();
  }
}

module.exports = {
  VarsReader,
  WranglerCmd,
};
