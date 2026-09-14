import { spawn } from 'node:child_process';
process.env.RUN_DB_TESTS = '1';
const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run'], {
  stdio: 'inherit',
  env: process.env,
  windowsHide: true,
});
child.on('exit', (code) => process.exit(code ?? 1));
