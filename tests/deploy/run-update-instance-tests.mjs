import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

function findBash() {
  if (process.platform !== 'win32') {
    return 'bash';
  }

  const candidates = [
    process.env.ProgramFiles
      ? join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe')
      : undefined,
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe')
      : undefined,
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

const bash = findBash();
if (!bash) {
  console.error('Git Bash is required to run the deployment shell tests.');
  process.exit(1);
}

const result = spawnSync(
  bash,
  ['tests/deploy/update-instance.test.sh', 'deploy/update-instance.sh'],
  { stdio: 'inherit' },
);
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
