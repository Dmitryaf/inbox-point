export function renderVkSetupInstructionsPart1() {
  return (
    <>
      <ol className="setup-steps" data-r-aa9e848d="">
        <li data-r-aa9e848d="">
          <strong data-r-aa9e848d="">
            {'Откройте управление сообществом.'}
          </strong>
          <span data-r-aa9e848d="">
            {
              ' Зайдите в нужное сообщество VK с учётной записи администратора и нажмите «Управление». '
            }
          </span>
        </li>
        <li data-r-aa9e848d="">
          <strong data-r-aa9e848d="">
            {'Разрешите сообщения сообщества.'}
          </strong>
          <span data-r-aa9e848d="">
            {
              ' Откройте «Сообщения» и включите сообщения сообщества, чтобы в него можно было написать. '
            }
          </span>
        </li>
        <li data-r-aa9e848d="">
          <strong data-r-aa9e848d="">{'Включите возможности ботов.'}</strong>
          <span data-r-aa9e848d="">
            {
              ' В настройках сообщений откройте раздел для бота и включите «Возможности ботов». '
            }
          </span>
        </li>
        <li data-r-aa9e848d="">
          <strong data-r-aa9e848d="">{'Настройте Long Poll API.'}</strong>
          <span data-r-aa9e848d="">
            {
              ' Перейдите в «Настройки» → «Работа с API» → «Long Poll API». Включите его и на вкладке типов событий отметьте входящие сообщения. '
            }
          </span>
        </li>
        <li data-r-aa9e848d="">
          <strong data-r-aa9e848d="">{'Создайте ключ доступа.'}</strong>
          <span data-r-aa9e848d="">
            {
              ' В разделе «Ключи доступа» создайте ключ сообщества и разрешите ему работу с сообщениями сообщества. '
            }
          </span>
        </li>
        <li data-r-aa9e848d="">
          <strong data-r-aa9e848d="">{'Заполните форму ниже.'}</strong>
          <span data-r-aa9e848d="">
            {
              ' Скопируйте адрес сообщества из браузера, вставьте созданный ключ и нажмите «Подключить VK». '
            }
          </span>
        </li>
      </ol>
    </>
  );
}
