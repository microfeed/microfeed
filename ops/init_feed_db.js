const {exec} = require('child_process');
const {promisify} = require('util');
const {WranglerCmd} = require("./lib/utils");
const {MIGRATIONS} = require("./db/migrations");

const execAsync = promisify(exec);

const cmd = new WranglerCmd(process.env.DEPLOYMENT_ENVIRONMENT || 'development');

function logResult({stdout, stderr}) {
  if (stdout) {
    console.log(`stdout: ${stdout}`);
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
  }
}

async function run(command, {tolerate = false} = {}) {
  try {
    logResult(await execAsync(command));
  } catch (error) {
    // Tolerated steps (migrations) log but never fail the deploy.
    console.log(`${tolerate ? 'skip' : 'error'}: ${error.message}`);
    if (error.stdout) {
      console.log(`stdout: ${error.stdout}`);
    }
    if (error.stderr) {
      console.log(`stderr: ${error.stderr}`);
    }
  }
}

(async () => {
  // 1) Create the DB (no-op if it already exists).
  await run(cmd.createFeedDb());

  // 2) Apply tolerant column migrations to existing tables (before init.sql so
  //    its indexes on the new columns succeed).
  for (const sql of MIGRATIONS) {
    await run(cmd.executeFeedDbSql(sql), {tolerate: true});
  }

  // 3) Create/ensure tables + indexes from init.sql.
  await run(cmd.createFeedDbTables());
})();
