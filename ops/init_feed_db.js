const { exec } = require('child_process');
const { WranglerCmd } = require('./lib/utils');

const cmd = new WranglerCmd(process.env.DEPLOYMENT_ENVIRONMENT || 'development');

function run(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
      }
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

(async () => {
  try {
    await new Promise((resolve, reject) => {
      cmd.ensureFeedDbExists((databaseId) => {
        if (!databaseId) {
          reject(new Error('Failed to ensure FEED_DB exists.'));
          return;
        }
        resolve(databaseId);
      });
    });

    await run(cmd.createFeedDbTables());
  } catch (error) {
    console.log(`error: ${error.message}`);
    process.exit(1);
  }
})();
