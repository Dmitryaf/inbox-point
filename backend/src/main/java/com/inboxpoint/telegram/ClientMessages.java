package com.inboxpoint.telegram;

final class ClientMessages {
    static final String ACTIVE_COMMAND_UNAVAILABLE = "Эта команда сейчас недоступна. Напишите сообщение обычным текстом — мы ответим здесь.";
    static final String ACTIVE_MENU = "Меню открыто. Выберите нужное действие или просто напишите сообщение, чтобы продолжить разговор.";
    static final String CLOSED_CONVERSATION = "Предыдущий разговор завершён. Выберите нужную кнопку или нажмите «Задать вопрос». Если кнопки не видны, отправьте слово «Меню».";
    static final String GREETING = "Здравствуйте! Выберите нужный раздел или задайте вопрос. Если кнопки не видны, отправьте слово «Меню».";
    static final String HANDOFF_DELAYED = "Ваш вопрос сохранён. Ответ может прийти позже обычного. Повторно отправлять его не нужно.";
    static final String HANDOFF_SENT = "Вопрос отправлен. Мы ответим здесь. Если кнопки не видны, отправьте слово «Меню».";
    static final String MENU_OPENED = "Выберите нужный раздел или задайте вопрос.";
    static final String MENU_UPDATED = "Эта кнопка больше не используется. Выберите другое действие ниже.";
    static final String NO_OPEN_REQUEST = "Такой команды нет. Выберите нужное действие ниже.";
    static final String PAUSED_INTAKE = "Сейчас мы временно не принимаем новые вопросы. Попробуйте написать позже или свяжитесь с нами по контактам в описании.";
    static final String QUESTION_PROMPT = "Напишите свой вопрос. Мы ответим здесь.";
    static final String UNSUPPORTED_CONTENT = "Сейчас можно отправить только текст. Напишите вопрос отдельным текстовым сообщением.";

    static final String APPLICATION_SENT = "Заявка отправлена. Администратор ответит здесь.";

    static final String APPLICATION_DELAYED = "Ваша заявка сохранена. Ответ может прийти позже обычного. Повторно отправлять её не нужно.";

    private ClientMessages() { }
}
