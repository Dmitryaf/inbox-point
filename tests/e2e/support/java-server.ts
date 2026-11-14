import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const port = Number(process.argv[2]);
const password = [4175, 4189].includes(port) ? '' : 'synthetic-admin-password';
const root = await mkdtemp(join(tmpdir(), 'inbox-point-java-browser-'));
const dbPath = join(root, 'inbox-point.sqlite');
const operations = [4193, 4194].includes(port);
const setup = port === 4192;
await writeFile(
  join(root, 'content-settings.json'),
  JSON.stringify({ formatVersion: 3, content: content(), history: [] }),
);
const fixtures = createServer((request, response) => {
  void answer(request).then(
    (body) => {
      response.writeHead(body === undefined ? 404 : 200, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify(body ?? { message: 'Unknown fixture' }));
    },
    () => {
      response.writeHead(500);
      response.end();
    },
  );
});
await new Promise<void>((done) => fixtures.listen(0, '127.0.0.1', done));
const address = fixtures.address();
if (!address || typeof address === 'string') {
  throw new Error('Fixture loopback port unavailable');
}
const fixtureOrigin = 'http://127.0.0.1:' + address.port;
const java = process.env.JAVA_HOME
  ? join(
      process.env.JAVA_HOME,
      'bin',
      process.platform === 'win32' ? 'java.exe' : 'java',
    )
  : 'java';
const jar = resolve('backend/target/inbox-point-0.0.0-SNAPSHOT.jar');
if (!existsSync(jar)) {
  throw new Error('Build the Java JAR before starting browser tests');
}
const serverOptions = [
  '--server.address=127.0.0.1',
  '--server.port=' + port,
  '--spring.main.banner-mode=off',
  '--logging.level.root=ERROR',
  '--DATABASE_PATH=' + dbPath,
  '--INBOXPOINT_ENV=test',
  '--ADMIN_PASSWORD=' + password,
  '--TELEGRAM_ENABLED=' + operations,
  '--TELEGRAM_BOT_TOKEN=',
  '--TELEGRAM_PROXY_URL=',
  '--VK_ENABLED=' + operations,
  '--VK_ACCESS_TOKEN=',
  '--HTTP_TRUSTED_PROXIES=',
];
const launcher = [
  '--enable-native-access=ALL-UNNAMED',
  '-Dloader.path=' + resolve('backend/target/test-classes'),
  '-Dloader.main=com.inboxpoint.operations.BrowserTestApplication',
  '-cp',
  jar,
  'org.springframework.boot.loader.launch.PropertiesLauncher',
  '--browser.fixture=' + fixtureOrigin,
  '--browser.mode=' +
    (operations ? 'operations' : setup ? 'setup' : 'analytics'),
];
const child = spawn(java, ['-Xmx128m', ...launcher, ...serverOptions], {
  stdio: 'inherit',
  windowsHide: true,
});
process.once('SIGTERM', () => child.kill());
process.once('SIGINT', () => child.kill());
child.once('error', (error) => console.error(error.message));
child.once('close', (code) => {
  fixtures.closeAllConnections();
  fixtures.close();
  void rm(root, { recursive: true, force: true }).then(() => {
    process.exitCode = code ?? 1;
  });
});

function content() {
  const editor = port === 4190 || port === 4191;
  return {
    ...(editor || operations || setup
      ? { organizationName: 'Учебная организация' }
      : {}),
    prices: 'Пробное занятие — бесплатно.',
    address: 'ул. Примерная, 10',
    faq: [{ question: 'Как записаться?', answer: 'Напишите нам.' }],
    customSections: editor
      ? [
          {
            id: 'school',
            label: 'О школе',
            text: 'Сохранённая информация',
            mode: 'information',
          },
        ]
      : [],
    directions: [{ id: 'dance', name: editor ? 'Танец' : 'Бачата' }],
    groups: [
      {
        id: editor ? 'group' : 'beginners',
        directionId: 'dance',
        name: 'Начинающие',
        meetings: [
          editor ? 'Понедельник, 19:00' : 'Понедельник и среда, 19:00.',
        ],
        description: '',
        enrollmentOpen: false,
        applicationQuestion: '',
      },
      ...(editor
        ? [
            {
              id: 'review',
              directionId: '',
              name: '',
              meetings: [],
              description: '',
              enrollmentOpen: false,
              applicationQuestion: '',
              review: { source: 'Необычная запись\nСреда, 21:00\nС нуля' },
            },
          ]
        : []),
    ],
    keywords: editor
      ? [{ phrase: 'танцы', targetType: 'group', targetId: 'group' }]
      : [],
  };
}

async function answer(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    }
  }
  const body = Buffer.concat(chunks).toString('utf8');
  const path = new URL(request.url ?? '/', fixtureOrigin).pathname;
  if (!setup) {
    return;
  }
  if (path.startsWith('/bot')) {
    return telegram(path.split('/').at(-1)!, body);
  }
  if (path === '/vk-poll') {
    return { ts: '1', updates: [] };
  }
  const method = path.split('/').at(-1);
  const params = new URLSearchParams(body);
  const vk = {
    'groups.getTokenPermissions': {
      permissions: params.get('access_token')?.includes('missing-messages')
        ? [{ name: 'manage' }]
        : [{ name: 'manage' }, { name: 'messages' }],
    },
    'utils.resolveScreenName': { type: 'group', object_id: 12345 },
    'groups.getLongPollSettings': {
      is_enabled: 1,
      events: { message_new: 1, message_reply: 1 },
    },
    'groups.getLongPollServer': {
      key: 'synthetic-key',
      server: fixtureOrigin + '/vk-poll',
      ts: '1',
    },
  };
  return method && Object.hasOwn(vk, method)
    ? { response: vk[method as keyof typeof vk] }
    : undefined;
}

function telegram(method: string, body: string) {
  const input = JSON.parse(body) as { chat_id?: number; timeout?: number };
  const chats = [
    {
      id: -1001,
      is_forum: true,
      type: 'supergroup',
      title: 'Группа сотрудников с длинным названием для проверки интерфейса',
    },
    { id: -1002, is_forum: false, type: 'supergroup', title: 'Группа без тем' },
  ];
  const responses = {
    getMe: { id: 501, is_bot: true },
    getWebhookInfo: { url: '' },
    getChat: chats.find((chat) => chat.id === input.chat_id),
    getChatMember: { status: 'administrator', can_manage_topics: true },
    getUpdates:
      input.timeout === 0
        ? chats.map((chat, index) => ({
            update_id: 100 + index,
            message: { chat },
          }))
        : [],
  };
  return Object.hasOwn(responses, method)
    ? { ok: true, result: responses[method as keyof typeof responses] }
    : undefined;
}
