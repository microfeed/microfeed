const {exec} = require('child_process');
const {WranglerCmd} = require("./lib/utils");

const cmd = new WranglerCmd(process.env.DEPLOYMENT_ENVIRONMENT || 'development');
exec(cmd.createFeedDb(), (error, stdout, stderr) => {
  if (error) {
    console.log(`error: ${error.message}`);
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
  }
  if (stdout) {
    console.log(`stdout: ${stdout}`);
  }
  exec(cmd.createFeedDbTables(), (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
    }
    if (stdout) {
      console.log(`stdout: ${stdout}`);
    }
  });
});
