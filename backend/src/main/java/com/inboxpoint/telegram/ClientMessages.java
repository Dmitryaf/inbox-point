package com.inboxpoint.telegram;

final class ClientMessages {
    static final String ACTIVE_COMMAND_UNAVAILABLE = "Эта команда сейчас недоступна. Напишите сообщение обычным текстом — мы ответим здесь.";
    static final String ACTIVE_MENU = "Меню открыто. Выберите нужное действие или просто напишите сообщение, чтобы продолжить разговор.";
    static final String CLOSED_CONVERSATION = "Предыдущий разговор завершён. Если хотите задать новый вопрос, нажмите «Задать вопрос».";
    static final String GREETING = "Здравствуйте! Выберите нужный раздел или задайте вопрос.";
    static final String HANDOFF_DELAYED = "Ваш вопрос сохранён. Ответ может прийти позже обычного. Повторно отправлять его не нужно.";
    static final String HANDOFF_SENT = "Вопрос отправлен. Мы ответим здесь.";
    static final String MENU_OPENED = "Выберите нужный раздел или задайте вопрос.";
    static final String MENU_UPDATED = "Эта кнопка больше не используется. Выберите другое действие ниже.";
    static final String NO_OPEN_REQUEST = "Такой команды нет. Выберите нужное действие ниже.";
    static final String PAUSED_INTAKE = "Сейчас мы временно не принимаем новые вопросы. Попробуйте написать позже или свяжитесь с нами по контактам в описании.";
    static final String QUESTION_PROMPT = "Напишите свой вопрос. Мы ответим здесь.";
    static final String UNSUPPORTED_CONTENT = "Сейчас можно отправить только текст. Напишите вопрос отдельным текстовым сообщением.";

    private ClientMessages() { }
}
