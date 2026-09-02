import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const managePageHtml = `<!doctype html>
<html lang='ru'>
  <head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width,initial-scale=1'>
    <title>Информация для клиентов</title>
    <link rel='stylesheet' href='/manage/style.css'>
  </head>
  <body>
    <div id='app'>
      <section id='login-section' hidden>
        <h1>Вход</h1>
        <p>Введите пароль, который выдал администратор сервиса.</p>
        <form id='login-form'>
          <label for='password'>Пароль</label>
          <input id='password' type='password' autocomplete='current-password' required>
          <button type='submit'>Войти</button>
        </form>
        <p id='login-status' class='status' role='status' aria-live='polite'></p>
      </section>

      <div id='editor' hidden>
        <header>
          <div>
            <h1>Информация для клиентов</h1>
            <p>Изменения сразу появятся в Telegram и VK.</p>
          </div>
          <button id='logout' class='secondary' type='button'>Выйти</button>
        </header>

        <form id='content-form'>
          <section>
            <h2>Основная информация</h2>
            <label for='schedule'>Расписание</label>
            <p class='hint'>Каждое занятие указывайте с новой строки.</p>
            <textarea id='schedule' rows='6' maxlength='4000' placeholder='Пн, пт — начинающая группа в 19:00&#10;Вт, чт — старшая группа в 20:00'></textarea>

            <label for='prices'>Цены</label>
            <p class='hint'>Каждый вариант оплаты указывайте с новой строки.</p>
            <textarea id='prices' rows='6' maxlength='4000' placeholder='Разовое занятие — 500 ₽&#10;Абонемент на 4 занятия — 3200 ₽'></textarea>

            <label for='address'>Адрес</label>
            <textarea id='address' rows='3' maxlength='4000' placeholder='Улица, дом, ориентир'></textarea>
          </section>

          <section>
            <h2>Частые вопросы</h2>
            <p>Добавляйте вопросы и ответы отдельными карточками. Порядок карточек сохранится в сообщении.</p>
            <div id='faq-items'></div>
            <button id='add-faq' class='secondary' type='button'>Добавить вопрос</button>
          </section>

          <section>
            <h2>Дополнительные кнопки</h2>
            <p>Добавьте до шести собственных информационных разделов.</p>
            <div id='custom-sections'></div>
            <button id='add-section' class='secondary' type='button'>Добавить кнопку</button>
          </section>

          <section>
            <h2>Предпросмотр</h2>
            <p class='hint'>Так текст будет выглядеть у клиента. Пустые разделы не показываются.</p>
            <div id='preview'></div>
          </section>

          <div class='save-bar'>
            <button id='save' type='submit'>Сохранить изменения</button>
            <p id='save-status' class='status' role='status' aria-live='polite'></p>
          </div>
        </form>

        <section>
          <h2>Последние изменения</h2>
          <ul id='history'></ul>
          <p id='history-empty' class='hint'>Изменений пока нет.</p>
        </section>
      </div>

      <script type='module' src='/manage/app.js'></script>
    </div>
  </body>
</html>`;

export const managePageStyles = `
:root {
  color-scheme: light;
  font-family: system-ui, sans-serif;
  color: #172033;
  background: #f4f6f9;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
}
main {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 16px;
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
section {
  margin: 16px 0;
  padding: 20px;
  border-radius: 14px;
  background: white;
  box-shadow: 0 1px 5px #00000012;
}
h1, h2, h3, p {
  margin-top: 0;
}
label {
  display: block;
  margin-top: 18px;
  font-weight: 650;
}
input, select, textarea, button {
  width: 100%;
  min-height: 46px;
  margin-top: 8px;
  border: 1px solid #c7cfdb;
  border-radius: 9px;
  font: inherit;
}
input, select, textarea {
  padding: 11px 12px;
  color: inherit;
  background: white;
}
textarea {
  resize: vertical;
}
button {
  padding: 10px 16px;
  border-color: #1769e0;
  color: white;
  background: #1769e0;
  cursor: pointer;
  font-weight: 650;
}
button:disabled {
  cursor: wait;
  opacity: 0.65;
}
button.secondary {
  border-color: #c7cfdb;
  color: #172033;
  background: white;
}
header button {
  width: auto;
  min-width: 90px;
  margin-top: 0;
}
.hint {
  margin: 4px 0 0;
  color: #5f6877;
  font-size: 0.92rem;
}
.status {
  min-height: 24px;
  margin: 10px 0 0;
}
.faq-item,
.custom-section {
  margin: 14px 0;
  padding: 14px;
  border: 1px solid #d9dee7;
  border-radius: 10px;
}
.faq-item h3,
.custom-section h3 {
  margin-bottom: 0;
}
.faq-item .remove,
.custom-section .remove {
  border-color: #d2a5a5;
  color: #8b2020;
  background: #fff8f8;
}
.preview-card {
  margin-top: 12px;
  padding: 14px;
  border-radius: 10px;
  background: #f1f4f8;
}
.preview-card h3 {
  margin-bottom: 8px;
}
.preview-text {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.save-bar {
  position: sticky;
  bottom: 0;
  z-index: 2;
  padding: 12px 0;
  background: linear-gradient(#f4f6f900, #f4f6f9 18%);
}
#history {
  padding-left: 20px;
}
#history li {
  margin: 8px 0;
}
@media (max-width: 520px) {
  main {
    padding: 10px;
  }
  section {
    padding: 16px;
  }
  header {
    display: block;
  }
  header button {
    width: 100%;
    margin-bottom: 4px;
  }
}
`;

export const managePageScript = readFileSync(
  resolve('dist/frontend/app.js'),
  'utf8',
);
