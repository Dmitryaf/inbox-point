package com.inboxpoint.content;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ClientMenuTest {
    private static final ClientMenu.State FIRST = new ClientMenu.State(ClientMenu.Stage.FIRST_CONTACT, false, false);
    private static final String DOCUMENT = """
            {
              "formatVersion": 3,
              "content": {
                "prices": "- 500 рублей",
                "address": "Синтетический адрес",
                "visibleSections": ["schedule","prices","faq"],
                "faq": [{"question":"Нужна форма?","answer":"Подойдёт удобная одежда."}],
                "customSections": [{"id":"visit","mode":"application","label":"Пробное занятие","text":"Выберите день."}],
                "directions": [{"id":"music","name":"Музыка"}],
                "groups": [
                  {"id":"intro","directionId":"music","name":"Начальная","meetings":["Суббота 10:00"],
                   "description":"Описание","enrollmentOpen":true,"applicationQuestion":"Когда вам удобно?",
                   "confirmationText":"Ждём в субботу!"},
                  {"id":"advanced","directionId":"music","name":"Старшая","meetings":["Воскресенье 11:00"],
                   "description":"","enrollmentOpen":false,"applicationQuestion":""}
                ],
                "keywords": [{"phrase":"Первые шаги","targetType":"group","targetId":"intro"}]
              },
              "history":[{"revision":1,"content":{"customSections":[{"label":"Старая кнопка","text":"Архив"}]}}]
            }
            """;

    @Test
    void telegramTextAndVkActionResolveTheSameFaq() {
        var menu = menu();

        var text = menu.resolve("Частые вопросы", null, FIRST).orElseThrow();
        var callback = menu.resolve("", "faq", FIRST).orElseThrow();

        assertThat(text).isEqualTo(callback);
        assertThat(text.text()).isEqualTo("Частые вопросы\n\n❓ Нужна форма?\nПодойдёт удобная одежда.");
        assertThat(text.intent()).isNull();
        assertThat(text.rows().stream().flatMap(java.util.Collection::stream).map(ClientMenu.Button::label))
                .doesNotContain("Адрес");
    }

    @Test
    void rejectsStaleSignupOnAClosedGroupButAllowsAContextualQuestion() {
        var menu = menu();

        var staleSignup = menu.resolve("", "classes:signup:advanced", FIRST).orElseThrow();
        assertThat(staleSignup.text()).contains("Чтобы уточнить запись на занятие");
        assertThat(staleSignup.intent()).isNull();

        var group = menu.resolve("", "classes:group:advanced", FIRST).orElseThrow();
        assertThat(group.rows().stream().flatMap(java.util.Collection::stream).map(ClientMenu.Button::action))
                .contains("classes:question:advanced").doesNotContain("classes:signup:advanced");
        var question = menu.resolve("Вопрос: Музыка / Старшая", null, FIRST).orElseThrow();
        assertThat(question.intent()).isEqualTo(new ClientMenu.Intent(null, "Музыка / Старшая", null));
    }

    @Test
    void retainsTheConfiguredSignupQuestionAndConfirmation() {
        var menu = menu();

        var group = menu.resolve("  ПЕРВЫЕ   ШАГИ  ", null, FIRST).orElseThrow();
        assertThat(group.text()).contains("Суббота 10:00", "Набор открыт.");

        var signup = menu.resolve("", "classes:signup:intro", FIRST).orElseThrow();
        assertThat(signup.text()).contains("Когда вам удобно?");
        assertThat(signup.intent()).isEqualTo(new ClientMenu.Intent("Музыка / Начальная", null, "Ждём в субботу!"));
    }

    @Test
    void handlesApplicationMenuButtonsAndLetsThePendingAnswerRemainFreeText() {
        var menu = menu();
        var application = menu.resolve("Пробное занятие", null, FIRST).orElseThrow();
        assertThat(application.text()).isEqualTo("Выберите день.");
        assertThat(application.intent()).isEqualTo(new ClientMenu.Intent("Пробное занятие", null, null));

        var awaiting = new ClientMenu.State(ClientMenu.Stage.AWAITING_QUESTION, false, true);
        assertThat(menu.resolve("Первые шаги", null, awaiting)).isEmpty();
        assertThat(menu.resolve("Меню", null, awaiting).orElseThrow().cancelIntent()).isTrue();
    }

    @Test
    void convertsKnownLegacyScheduleRowsToClosedGroupsAndKeepsUnparsedRowsForReview() {
        var legacy = """
                {"content":{"schedule":"Старое поле совместимости","scheduleItems":[
                  {"title":"Бачата парная (начинающие)","dayTime":"Суббота 10:00"},
                  {"title":"Неоднозначная запись","dayTime":"По договорённости"}
                ]},"history":[]}
                """;
        var menu = new ClientMenu(ClientCatalog.parse(legacy));
        var directions = menu.resolve("Расписание", null, FIRST).orElseThrow();
        var direction = directions.rows().getFirst().getFirst();
        assertThat(direction.label()).isEqualTo("Бачата парная");
        var group = menu.resolve("", direction.action(), FIRST).orElseThrow().rows().getFirst().getFirst();
        var card = menu.resolve("", group.action(), FIRST).orElseThrow();
        assertThat(card.text()).contains("Суббота 10:00").doesNotContain("Набор открыт");
        assertThat(card.rows().stream().flatMap(java.util.Collection::stream).map(ClientMenu.Button::label))
                .doesNotContain("Записаться на занятие");
        var review = menu.resolve("", "classes:review:0", FIRST).orElseThrow();
        assertThat(review.text()).contains("Неоднозначная запись\nПо договорённости")
                .doesNotContain("Старое поле совместимости");
    }

    @Test
    void handlesStaleLabelsAndPreventsAnUnsolicitedNewRequestAfterClosure() {
        var menu = menu();
        assertThat(menu.resolve("Старая кнопка", null, FIRST).orElseThrow().text())
                .contains("Эта кнопка больше не используется.");
        var closed = new ClientMenu.State(ClientMenu.Stage.CLOSED, false, false);
        var unsolicited = menu.resolve("Новый вопрос без выбора", null, closed).orElseThrow();
        assertThat(unsolicited.text()).contains("Предыдущий разговор завершён.");
        assertThat(unsolicited.intent()).isNull();
    }

    private static ClientMenu menu() {
        return new ClientMenu(ClientCatalog.parse(DOCUMENT));
    }
}
