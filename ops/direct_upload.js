const { exec } = require('child_process');
const { WranglerCmd } = require('./lib/utils');

const cmd = new WranglerCmd(process.env.DEPLOYMENT_ENVIRONMENT || 'production');

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
  let exitCode = 0;

  try {
    await run('node ops/generate_pages_wrangler_config.js');
    await run('yarn build:production');
    await run(cmd.publishProject());
  } catch (error) {
    console.log(`error: ${error.message}`);
    exitCode = 1;
  } finally {
    try {
      await run('node ops/restore_wrangler_config.js');
    } catch (restoreError) {
      console.log(`restore_error: ${restoreError.message}`);
      exitCode = 1;
    }
  }

  process.exit(exitCode);
})();
