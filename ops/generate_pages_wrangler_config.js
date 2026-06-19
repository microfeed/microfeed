const fs = require('fs');
const path = require('path');
const { WranglerCmd, VarsReader } = require('./lib/utils');

const currentEnv = process.env.DEPLOYMENT_ENVIRONMENT || 'production';
const vars = new VarsReader(currentEnv);
const cmd = new WranglerCmd(currentEnv);
const outputPath = path.join(process.cwd(), 'wrangler.toml');
const backupPath = path.join(process.cwd(), '.wrangler.toml.backup');

function buildConfig(databaseId) {
  const bucketName = vars.get('R2_PUBLIC_BUCKET') || 'microfeed-public';
  const lines = [
    'name = "microfeed"',
    'compatibility_date = "2025-03-14"',
    'pages_build_output_dir = "public"',
    '',
    `[env.${currentEnv}]`,
    '',
    `[[env.${currentEnv}.r2_buckets]]`,
    'binding = "R2_BUCKET"',
    `bucket_name = "${bucketName}"`,
  ];

  if (databaseId) {
    lines.push(
      '',
      `[[env.${currentEnv}.d1_databases]]`,
      'binding = "FEED_DB"',
      `database_name = "${cmd._non_dev_db()}"`,
      `database_id = "${databaseId}"`,
    );
  }

  return `${lines.join('\n')}\n`;
}

cmd.getDatabaseId((databaseId) => {
  if (!databaseId) {
    console.error('[generate_pages_wrangler_config] Missing database ID for deploy.');
    process.exit(1);
  }

  if (fs.existsSync(outputPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(outputPath, backupPath);
  }
  fs.writeFileSync(outputPath, buildConfig(databaseId), 'utf8');
  console.log(outputPath);
});
