const {exec} = require('child_process');
const {WranglerCmd} = require("./lib/utils");

const cmd = new WranglerCmd(process.env.DEPLOYMENT_ENVIRONMENT || 'production');
exec(cmd.createFeedDb(), (error, stdout, stderr) => {
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
