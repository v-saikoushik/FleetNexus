/**
 * Load root .env into process.env, then run a command.
 * Usage: node ./scripts/with-env.mjs <command> [args...]
 */
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const envPath = resolve(root, '.env');

try {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
} catch {
  // .env may be missing in CI when vars are injected externally
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node ./scripts/with-env.mjs <command> [args...]');
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  env: process.env,
  shell: true,
  cwd: root,
});

process.exit(result.status ?? 1);
