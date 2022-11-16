const {exec} = require('child_process');
const fs = require("fs");
const dotenv = require("dotenv");

const buffer = fs.readFileSync('.dev.vars');
const env = dotenv.parse(buffer);

const envName = process.env.DEPLOYMENT_ENVIRONMENT || 'production';
const bufferForEnv = fs.readFileSync(`.${envName}.vars`);
const envJson = dotenv.parse(bufferForEnv);

const projectName = envJson.CLOUDFLARE_PROJECT_NAME || env.CLOUDFLARE_PROJECT_NAME;
const productionBranch = envJson.PRODUCTION_BRANCH || env.PRODUCTION_BRANCH || 'main';

// Cloudflare Pages direct upload uses branch to decide deployment environment.
// If we want production, then use production_branch. Otherwise, just something else
const branch = envName === 'production' ? productionBranch : `${productionBranch}-preview`;

const cmd = `wrangler pages publish public --project-name ${projectName} --branch ${branch}`;

console.log(cmd);

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
