const fs = require('fs');
const toml = require('toml');

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

  createFeedDb() {
    const wranglerCmd = this.currentEnv !== 'development' ?
      `wrangler d1 create feed_db-${this.currentEnv}` : 'echo "FEED_DB"';
    console.log(wranglerCmd);
    return this._getCmd(wranglerCmd);
  }

  createFeedDbTables() {
    const dbName = this.currentEnv !== 'development' ? `feed_db-${this.currentEnv}` : 'FEED_DB --local';
    const wranglerCmd = `wrangler d1 execute ${dbName} --file ops/db/init.sql`;
    console.log(wranglerCmd);
    return this._getCmd(wranglerCmd);
  }
}

module.exports = {
  VarsReader,
  WranglerCmd,
};
