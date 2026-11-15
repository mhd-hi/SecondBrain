import { execFileSync, spawnSync } from 'node:child_process';

if (process.env.NODE_ENV !== 'production') {
  const result = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || 'Could not read Git hook configuration');
  }
  if (!result.stdout.trim()) {
    execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
  }
}
