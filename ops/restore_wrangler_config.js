const fs = require('fs');
const path = require('path');

const outputPath = path.join(process.cwd(), 'wrangler.toml');
const backupPath = path.join(process.cwd(), '.wrangler.toml.backup');

if (fs.existsSync(backupPath)) {
  fs.copyFileSync(backupPath, outputPath);
  fs.unlinkSync(backupPath);
  console.log('[restore_wrangler_config] Restored wrangler.toml from backup.');
} else {
  console.log('[restore_wrangler_config] No backup found. Nothing to restore.');
}
