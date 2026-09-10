export function renderTelegramSetupInstructionsPart1() {
  return (
    <>
      <ol className="setup-steps" data-r-9c77fc79="">
        <li data-r-9c77fc79="">
          <strong data-r-9c77fc79="">{'Создайте бота.'}</strong>
          <span data-r-9c77fc79="">
            {
              ' Откройте @BotFather в Telegram, выполните команду /newbot и скопируйте выданный токен. '
            }
          </span>
        </li>
        <li data-r-9c77fc79="">
          <strong data-r-9c77fc79="">
            {'Подготовьте закрытую группу операторов.'}
          </strong>
          <span data-r-9c77fc79="">
            {
              ' Создайте закрытую группу, откройте её настройки и включите «Темы». '
            }
          </span>
        </li>
        <li data-r-9c77fc79="">
          <strong data-r-9c77fc79="">{'Добавьте бота администратором.'}</strong>
          <span data-r-9c77fc79="">
            {
              ' В правах администратора обязательно разрешите боту управлять темами. '
            }
          </span>
        </li>
        <li data-r-9c77fc79="">
          <strong data-r-9c77fc79="">
            {'Сделайте группу доступной для поиска.'}
          </strong>
          <span data-r-9c77fc79="">
            {
              ' Напишите в подготовленной группе любое сообщение, затем вставьте токен ниже и нажмите «Найти группы». '
            }
          </span>
        </li>
        <li data-r-9c77fc79="">
          <strong data-r-9c77fc79="">{'Завершите подключение.'}</strong>
          <span data-r-9c77fc79="">
            {' Выберите найденную группу и нажмите «Подключить Telegram». '}
          </span>
        </li>
      </ol>
    </>
  );
}
