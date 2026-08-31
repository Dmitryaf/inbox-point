import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const [command, ...args] = process.argv.slice(2);
const windows = process.platform === 'win32';
let result;

if (command === 'build' || command === 'package') {
  const wrapper = windows
    ? ['cmd.exe', ['/d', '/c', 'mvnw.cmd']]
    : ['sh', ['mvnw']];
  const goals = command === 'build' ? ['verify'] : ['-DskipTests', 'package'];
  result = spawnSync(wrapper[0], [...wrapper[1], '-B', '-ntp', ...goals], {
    cwd: 'backend',
    stdio: 'inherit',
  });
} else {
  const config = command === 'availability-monitor' ? '.env.monitor' : '.env';
  if (
    ['availability-monitor', 'snapshot-create'].includes(command) &&
    existsSync(config)
  ) {
    process.loadEnvFile(config);
  }
  const java = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, 'bin', windows ? 'java.exe' : 'java')
    : 'java';
  const argumentsForJar = command === 'start' ? args : [command, ...args];
  result = spawnSync(
    java,
    [
      '-jar',
      'backend/target/inbox-point-0.0.0-SNAPSHOT.jar',
      ...argumentsForJar,
    ],
    {
      stdio: 'inherit',
    },
  );
}

if (result.error) {
  console.error(result.error.message);
}
process.exitCode = result.status ?? 1;
