import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const setupPageHtml = `<!doctype html>
<html lang='ru'>
  <head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width,initial-scale=1'>
    <title>Messenger Handoff</title>
    <link rel='stylesheet' href='/setup/style.css'>
  </head>
  <body>
    <div id='app'>
      <h1>Messenger Handoff</h1>
      <section>
        <h2>Подключение Telegram</h2>
        <div id='wizard' hidden>
          <ol>
            <li>Создайте закрытую группу и включите темы.</li>
            <li>Добавьте бота администратором с правом управлять темами.</li>
            <li>Напишите в группе любое сообщение.</li>
          </ol>
          <label>Токен от @BotFather <input id='token' type='password'></label>
          <button id='discover'>Найти группы</button>
          <div id='chats'></div>
          <button id='connect' hidden>Подключить</button>
        </div>
        <p id='status'>Проверяем состояние…</p>
      </section>
      <section aria-labelledby='vk-title'>
        <h2 id='vk-title'>Подключение VK</h2>
        <div id='vk-wizard' hidden>
          <ol>
            <li>Откройте «Сообщения → Настройки для бота» и включите «Возможности ботов».</li>
            <li>В разделе «Работа с API» включите Long Poll API.</li>
            <li>В событиях Long Poll отметьте «Входящие сообщения».</li>
            <li>Создайте ключ доступа сообщества с правом работы с сообщениями.</li>
          </ol>
          <label>Ссылка на сообщество <input id='vk-community' type='text' placeholder='https://vk.com/your_community'></label>
          <label>Ключ доступа сообщества <input id='vk-token' type='password'></label>
          <button id='vk-connect'>Подключить VK</button>
        </div>
        <p id='vk-status'>Проверяем состояние…</p>
      </section>
      <section aria-labelledby='content-title'>
        <h2 id='content-title'>Информация для клиентов</h2>
        <p>Эти ответы одинаково отображаются в Telegram и VK. Пустой раздел будет отмечен как не заполненный.</p>
        <label>Расписание <textarea id='content-schedule' rows='5'></textarea></label>
        <label>Цены <textarea id='content-prices' rows='5'></textarea></label>
        <label>Адрес <textarea id='content-address' rows='3'></textarea></label>
        <h3>Дополнительные кнопки</h3>
        <p class='muted'>Можно добавить до шести собственных разделов. Частые вопросы редактируются на странице /manage.</p>
        <div id='custom-sections'></div>
        <button id='add-custom-section' type='button'>Добавить кнопку</button>
        <button id='save-content'>Сохранить информацию</button>
        <p id='content-status' class='muted'>Загружаем сохранённые значения…</p>
      </section>
      <section aria-labelledby='delivery-title'>
        <h2 id='delivery-title'>Доставка ответов</h2>
        <p id='delivery-summary'>Проверяем состояние…</p>
        <ul id='delivery-failures'></ul>
        <button id='refresh-deliveries'>Обновить</button>
        <p class='muted'>Тексты сообщений и данные клиентов здесь не отображаются.</p>
      </section>
      <section aria-labelledby='backup-title'>
        <h2 id='backup-title'>Резервная копия</h2>
        <p>Сохраните обращения и очередь доставки перед обновлением или переносом сервиса.</p>
        <button id='create-backup'>Создать резервную копию</button>
        <p id='backup-status' class='muted'>Токен Telegram в копию не входит.</p>
      </section>
      <script type='module' src='/setup/app.js'></script>
    </div>
  </body>
</html>`;

export const setupPageStyles = `
body {
  font: 16px/1.5 system-ui, sans-serif;
  margin: 0;
  color: #172033;
  background: #f5f7fa;
}
main {
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto;
  padding: 24px;
}
section {
  margin: 20px 0;
  padding: 20px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 1px 4px #0001;
}
label {
  display: block;
  margin: 12px 0;
}
input[type='password'], input[type='text'] {
  box-sizing: border-box;
  width: 100%;
  padding: 10px;
}
textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 10px;
  resize: vertical;
}
button {
  padding: 10px 14px;
  cursor: pointer;
}
#chats label {
  padding: 8px 0;
}
#delivery-failures {
  padding-left: 20px;
}
#delivery-failures li {
  margin: 10px 0;
}
#delivery-failures button {
  margin-left: 8px;
}
.custom-section {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid #d9dee7;
  border-radius: 8px;
}
.custom-section button {
  margin-bottom: 8px;
}
.muted {
  color: #5f6877;
}
`;

export const setupPageScript = readFileSync(
  resolve('dist/frontend/app.js'),
  'utf8',
);
