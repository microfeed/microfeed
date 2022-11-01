const {exec} = require('child_process');
const fs = require("fs");
const dotenv = require("dotenv");

const buffer = fs.readFileSync('.dev.vars');
const env = dotenv.parse(buffer);

const envName = 'production';
const bufferForEnv = fs.readFileSync(`.${envName}.vars`);
const envJson = dotenv.parse(bufferForEnv);

const projectName = envJson.PROJECT_NAME || env.PROJECT_NAME;
let branch = envJson.PRODUCTION_BRANCH || 'main';
if (envName !== 'production') {
  branch = 'preview';
}

const cmd = `wrangler pages publish public --project-name ${projectName} --branch ${branch}`;

console.log(cmd);

exec(`yarn build:production && ${cmd}`, (error, stdout, stderr) => {
  if (error) {
    console.log(`error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});
