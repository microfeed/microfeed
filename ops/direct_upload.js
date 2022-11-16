const {exec} = require('child_process');
const fs = require("fs");
const dotenv = require("dotenv");

const buffer = fs.readFileSync('.dev.vars');
const env = dotenv.parse(buffer);

const envName = process.env.DEPLOYMENT_ENVIRONMENT || 'production';
const bufferForEnv = fs.readFileSync(`.${envName}.vars`);
const envJson = dotenv.parse(bufferForEnv);

const projectName = envJson.CLOUDFLARE_PROJECT_NAME || env.CLOUDFLARE_PROJECT_NAME;
let branch = envJson.DEPLOYMENT_BRANCH || 'main';
if (envName !== 'production') {
  branch = 'preview';
}

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
