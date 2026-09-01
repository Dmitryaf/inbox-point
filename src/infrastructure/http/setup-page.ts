import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const setupPageHtml =
  '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Messenger Handoff</title></head><body><div id="app"><h1>Подключение Telegram</h1><section id="wizard" hidden><ol><li>Создайте закрытую группу и включите темы.</li><li>Добавьте бота администратором с правом управлять темами.</li><li>Напишите в группе любое сообщение.</li></ol><label>Токен от @BotFather <input id="token" type="password"></label><button id="discover">Найти группы</button><div id="chats"></div><button id="connect" hidden>Подключить</button></section><p id="status">Проверяем состояние…</p><script type="module" src="/setup/app.js"></script></div></body></html>';

export const setupPageScript = readFileSync(
  resolve('dist/frontend/app.js'),
  'utf8',
);
