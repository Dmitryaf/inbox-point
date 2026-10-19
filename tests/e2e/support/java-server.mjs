import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const argument = (name) =>
  process.argv
    .slice(2)
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);

const port = Number(argument('port') ?? 4174);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Invalid browser test port');
}

const directory = mkdtempSync(join(tmpdir(), 'handoff-browser-'));
writeFileSync(
  join(directory, 'content-settings.json'),
  JSON.stringify({
    content: {
      address: 'ул. Примерная, 10',
      faq: [
        { question: 'Как записаться?', answer: 'Напишите нам в мессенджере.' },
      ],
      prices: 'Пробное занятие — бесплатно.',
      schedule: [
        {
          dayTime: 'Понедельник и среда, 19:00.',
          title: 'Бачата — начинающие',
        },
      ],
    },
    history: [],
  }),
);
const executable = process.env.JAVA_HOME
  ? join(
      process.env.JAVA_HOME,
      'bin',
      process.platform === 'win32' ? 'java.exe' : 'java',
    )
  : 'java';
const server = spawn(
  executable,
  ['-jar', resolve('backend/target/inbox-point-0.0.0-SNAPSHOT.jar')],
  {
    env: {
      ...process.env,
      ADMIN_PASSWORD: argument('password') ?? '',
      DATABASE_PATH: join(directory, 'handoff.sqlite'),
      HOST: '127.0.0.1',
      ...(argument('frontend-root')
        ? { INBOXPOINT_FRONTEND_PATH: argument('frontend-root') }
        : {}),
      INBOXPOINT_ENV: 'test',
      PORT: String(port),
      TELEGRAM_ENABLED: 'false',
      VK_ENABLED: 'false',
    },
    stdio: 'inherit',
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.kill());
}
server.once('error', () => {
  process.exitCode = 1;
});
server.once('exit', (code) => {
  process.exitCode = code ?? 0;
});
