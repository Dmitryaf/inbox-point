export function telegramSetupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('supergroup') || message.includes('Topics')) {
    return 'Включите в выбранной группе темы и попробуйте снова.';
  }
  if (message.includes('administrator')) {
    return 'Назначьте бота администратором выбранной группы.';
  }
  if (message.includes('can_manage_topics')) {
    return 'Разрешите боту управлять темами группы.';
  }
  if (message.includes('webhook')) {
    return 'У бота уже настроена другая интеграция. Отключите её или создайте отдельного бота.';
  }
  if (message.includes('already connected')) {
    return 'Telegram уже подключён.';
  }
  if (message.includes('managed by server')) {
    return 'Эта настройка управляется сервером.';
  }
  return 'Не удалось подключиться. Проверьте токен, группу и права бота.';
}

export function vkSetupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('workspace is not connected')) {
    return 'Сначала подключите Telegram для операторов.';
  }
  if (message.includes('does not point to a community')) {
    return 'Укажите ссылку именно на сообщество VK.';
  }
  if (message.includes('already connected')) {
    return 'VK уже подключён.';
  }
  if (message.includes('managed by server')) {
    return 'Эта настройка управляется сервером.';
  }
  if (message.includes('code 15')) {
    return 'Включите Long Poll API в настройках сообщества VK.';
  }
  return 'Не удалось подключить VK. Проверьте ссылку, ключ и права сообщества.';
}
