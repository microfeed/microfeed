const {exec} = require('child_process');
const {VarsReader} = require("./lib/utils");

const currentEnv = process.env.DEPLOYMENT_ENVIRONMENT || 'production';
const v = new VarsReader(currentEnv);

const projectName = v.get('CLOUDFLARE_PROJECT_NAME');
const productionBranch = v.get('PRODUCTION_BRANCH', 'main');

// Cloudflare Pages direct upload uses branch to decide deployment environment.
// If we want production, then use production_branch. Otherwise, just something else
const branch = currentEnv === 'production' ? productionBranch : `${productionBranch}-preview`;

const wranglerCmd = `wrangler pages publish public --project-name ${projectName} --branch ${branch}`;
const cmd = `CLOUDFLARE_ACCOUNT_ID=${v.get('CLOUDFLARE_ACCOUNT_ID')} ` +
  `CLOUDFLARE_API_TOKEN=${v.get('CLOUDFLARE_API_TOKEN')} ` + wranglerCmd;

console.log(wranglerCmd);

exec(`yarn build:production && ${cmd}`, (error, stdout, stderr) => {
  if (error) {
    console.log(`error: ${error.message}`);
    process.exit(1);
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});
