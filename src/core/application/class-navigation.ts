import type {
  ClientInformationContent,
  ClientInformationResolver,
} from '@/core/application/client-information.js';
import type { ClientConversationState } from '@/core/model/client-conversation.js';
import { clientMessages } from '@/core/application/client-messages.js';
import { classSchedulePages } from './class-schedule.js';
import {
  defaultApplicationQuestion,
  groupTitle,
  normalizeKeyword,
  normalizeApplicationQuestion,
} from './class-content.js';

export interface ClassButton {
  label: string;
  action: string;
  command: string;
}
export interface ClassResponse {
  text: string;
  buttons: ClassButton[];
  actionKey?: string;
  actionLabel?: string;
  applicationLabel?: string;
  questionContext?: string;
  beginQuestion?: true;
}
const button = (
  label: string,
  action: string,
  command = label,
): ClassButton => ({ label: label.slice(0, 40), action, command });
const menu = () => button('Меню', 'main');
const directionsButton = () =>
  button('Другие направления', 'classes:directions:0', 'Направления: 1');
const updated = (): ClassResponse => ({
  text: clientMessages.menuUpdated,
  buttons: [menu()],
});

export function resolveClassNavigation(
  information: ClientInformationResolver,
  text: string,
  action: string | undefined,
  state: ClientConversationState,
): ClassResponse | undefined {
  const content = information.getContent?.() ?? {};
  let key = action?.startsWith('classes:') ? action : undefined;
  // Explicit buttons remain available in a conversation. Free text belongs to the administrator or pending application.
  if (
    !key &&
    !action &&
    state.stage !== 'awaiting_question' &&
    (state.stage !== 'active' || text.includes(':'))
  ) {
    key = resolveClassText(content, text);
  }
  if (
    !key &&
    (action === 'schedule' ||
      (!action &&
        text.trim() === 'Расписание' &&
        state.stage !== 'awaiting_question' &&
        state.stage !== 'active'))
  ) {
    if (content.directions?.length || content.groups?.length) {
      key = 'classes:directions:0';
    }
  }
  if (!key) {
    return undefined;
  }
  return renderClassAction(information, key, state);
}

export function resolveClassText(
  content: ClientInformationContent,
  text: string,
): string | undefined {
  const normalized = normalizeKeyword(text);
  const keyword = content.keywords?.find(
    (item) => normalizeKeyword(item.phrase) === normalized,
  );
  if (keyword) {
    return `classes:${keyword.targetType}:${keyword.targetId}${keyword.targetType === 'direction' ? ':0' : ''}`;
  }
  if (
    normalized === 'другие направления' ||
    (normalized === 'расписание' &&
      (content.directions?.length || content.groups?.length))
  ) {
    return 'classes:directions:0';
  }
  if (
    (normalized === 'другие занятия' || normalized === 'занятия: общие') &&
    content.directions?.length
  ) {
    return 'classes:legacy';
  }
  const page = /^направления: (\d+)$/u.exec(normalized);
  if (page) {
    return `classes:directions:${Number(page[1]) - 1}`;
  }
  const reviewPage = /^занятия: (\d+)$/u.exec(normalized);
  if (reviewPage) {
    return `classes:review:${Number(reviewPage[1]) - 1}`;
  }
  if (normalized === 'расписание всех направлений') {
    return 'classes:all:0';
  }
  const schedulePage = /^расписание всех направлений: (\d+)$/u.exec(normalized);
  if (schedulePage) {
    return `classes:all:${Number(schedulePage[1]) - 1}`;
  }
  for (const direction of content.directions ?? []) {
    if (normalized === normalizeKeyword(`Направление: ${direction.name}`)) {
      return `classes:direction:${direction.id}:0`;
    }
    const prefix = normalizeKeyword(`Группы: ${direction.name}:`) + ' ';
    if (
      normalized.startsWith(prefix) &&
      /^\d+$/u.test(normalized.slice(prefix.length))
    ) {
      return `classes:direction:${direction.id}:${Number(normalized.slice(prefix.length)) - 1}`;
    }
  }
  for (const group of content.groups ?? []) {
    const title = groupTitle(content, group);
    for (const [label, operation] of [
      ['Группа', 'group'],
      ['Расписание', 'times'],
      ['Записаться', 'signup'],
      ['Цены', 'prices'],
      ['Вопрос', 'question'],
    ] as const) {
      if (normalized === normalizeKeyword(`${label}: ${title}`)) {
        return `classes:${operation}:${group.id}`;
      }
    }
  }
  return undefined;
}

export function renderClassAction(
  information: ClientInformationResolver,
  action: string,
  state: ClientConversationState = {
    stage: 'first_contact',
    intakePaused: false,
  },
): ClassResponse {
  const content = information.getContent?.() ?? {};
  const [, operation, id, pageText] = action.split(':');
  if (operation === 'review' || operation === 'all') {
    const source =
      operation === 'review'
        ? (content.groups ?? [])
            .flatMap((group) => (group.review ? [group.review.source] : []))
            .join('\n\n')
        : (information.resolve('Расписание') ?? '').replace(
            /^Расписание\n\n/u,
            '',
          );
    const pages = classSchedulePages(source);
    const page = safePage(id, pages.length, 1);
    return {
      text:
        (operation === 'all'
          ? 'Расписание всех направлений\n\n'
          : 'Расписание\n\n') + (pages[page] ?? 'Расписание пока не указано.'),
      buttons: [
        ...pageButtons(
          page,
          pages.length,
          1,
          (next) => `classes:${operation}:${next}`,
          (next) =>
            operation === 'all'
              ? `Расписание всех направлений: ${next + 1}`
              : `Занятия: ${next + 1}`,
        ),
        directionsButton(),
        menu(),
      ],
    };
  }
  if (operation === 'directions') {
    const all = content.directions ?? [];
    if (!all.length && content.groups?.some((group) => group.review)) {
      return renderClassAction(information, 'classes:review:0', state);
    }
    const page = safePage(id, all.length, 2);
    const items = all.slice(page * 2, page * 2 + 2);
    return {
      text:
        'Расписание\n\nВыберите направление.' +
        (all.length > 2
          ? `\nСтраница ${page + 1} из ${Math.ceil(all.length / 2)}.`
          : ''),
      buttons: [
        ...items.map((item) =>
          button(
            item.name,
            `classes:direction:${item.id}:0`,
            `Направление: ${item.name}`,
          ),
        ),
        ...pageButtons(
          page,
          all.length,
          2,
          (next) => `classes:directions:${next}`,
          (next) => `Направления: ${next + 1}`,
        ),
        ...(content.groups?.length
          ? [button('Расписание всех направлений', 'classes:all:0')]
          : []),
        ...(!content.groups?.length &&
        (content.schedule?.length || content.legacySchedule)
          ? [button('Другие занятия', 'classes:legacy', 'Занятия: общие')]
          : []),
        menu(),
      ],
    };
  }
  if (operation === 'legacy') {
    if (content.groups?.length) {
      return renderClassAction(information, 'classes:directions:0', state);
    }
    return {
      text: information.resolve('Расписание') ?? 'Расписание пока не указано.',
      buttons: [directionsButton(), menu()],
    };
  }
  if (operation === 'direction') {
    const direction = content.directions?.find((item) => item.id === id);
    if (!direction) {
      return updated();
    }
    const all =
      content.groups?.filter(
        (item) => item.directionId === id && !item.review,
      ) ?? [];
    const page = safePage(pageText, all.length, 2);
    const groups = all.slice(page * 2, page * 2 + 2);
    return {
      actionKey: `direction:${direction.id}`,
      actionLabel: `Направление: ${direction.name}`,
      text:
        `${direction.name}\n\n${groups.length ? 'Выберите группу.' : 'Группы пока не добавлены.'}` +
        (all.length > 2
          ? `\n\nСтраница ${page + 1} из ${Math.ceil(all.length / 2)}.`
          : ''),
      buttons: [
        ...groups.map((group) =>
          button(
            group.name,
            `classes:group:${group.id}`,
            `Группа: ${groupTitle(content, group)}`,
          ),
        ),
        ...pageButtons(
          page,
          all.length,
          2,
          (next) => `classes:direction:${id}:${next}`,
          (next) => `Группы: ${direction.name}: ${next + 1}`,
        ),
        directionsButton(),
        menu(),
      ],
    };
  }
  const group = content.groups?.find((item) => item.id === id);
  if (!group) {
    return updated();
  }
  if (group.review) {
    return renderClassAction(information, 'classes:review:0', state);
  }
  const title = groupTitle(content, group);
  const groupButton = () =>
    button('К группе', `classes:group:${id}`, `Группа: ${title}`);
  const canEnroll =
    group.enrollmentOpen && (!state.intakePaused || state.stage === 'active');
  if (operation === 'signup' || operation === 'question') {
    if (state.intakePaused && state.stage !== 'active') {
      return {
        text: clientMessages.pausedIntake,
        buttons: [groupButton(), menu()],
      };
    }
    if (operation === 'signup' && !group.enrollmentOpen) {
      return {
        text: `${title}\n\nНабор в эту группу закрыт. Можно посмотреть другие направления или задать вопрос.`,
        buttons: [groupButton(), directionsButton(), menu()],
      };
    }
    return {
      text:
        operation === 'signup'
          ? `${title}\n\n${normalizeApplicationQuestion(group.applicationQuestion) || defaultApplicationQuestion}\n\nЧтобы отменить, напишите «Меню».`
          : `${title}\n\n${clientMessages.questionPrompt}\nЧтобы отменить, напишите «Меню».`,
      buttons: [menu()],
      beginQuestion: true,
      ...(operation === 'signup'
        ? { applicationLabel: title }
        : { questionContext: title }),
      actionKey: `${operation === 'signup' ? 'signup' : 'group_question'}:${id}`,
      actionLabel: `${operation === 'signup' ? 'Начало записи' : 'Вопрос о группе'}: ${title}`,
    };
  }
  if (operation === 'prices') {
    return {
      text: information.resolve('Цены') ?? 'Цены пока не указаны.',
      buttons: [groupButton(), menu()],
    };
  }
  if (operation === 'times') {
    return {
      text: `${title}\n\n${group.meetings.join('\n')}`,
      buttons: [
        ...(canEnroll
          ? [
              button(
                'Записаться на занятие',
                `classes:signup:${id}`,
                `Записаться: ${title}`,
              ),
            ]
          : []),
        groupButton(),
        menu(),
      ],
    };
  }
  if (operation !== 'group') {
    return updated();
  }
  return {
    actionKey: `group:${id}`,
    actionLabel: `Группа: ${title}`,
    text: `${title}\n\n${group.description ? group.description + '\n\n' : ''}${group.meetings.join('\n')}\n\n${group.enrollmentOpen ? 'Набор открыт.' : 'Набор закрыт.'}\nВыберите нужное действие.`,
    buttons: [
      ...(canEnroll
        ? [
            button(
              'Записаться на занятие',
              `classes:signup:${id}`,
              `Записаться: ${title}`,
            ),
          ]
        : []),
      button('Цены', `classes:prices:${id}`, `Цены: ${title}`),
      ...(!state.intakePaused || state.stage === 'active'
        ? [
            button(
              'Задать вопрос',
              `classes:question:${id}`,
              `Вопрос: ${title}`,
            ),
          ]
        : []),
      directionsButton(),
      menu(),
    ],
  };
}
function safePage(
  value: string | undefined,
  length: number,
  size: number,
): number {
  const page = Number(value);
  return Number.isSafeInteger(page)
    ? Math.min(Math.max(0, page), Math.max(0, Math.ceil(length / size) - 1))
    : 0;
}
function pageButtons(
  page: number,
  length: number,
  size: number,
  action: (page: number) => string,
  command: (page: number) => string,
): ClassButton[] {
  return [
    ...(page > 0 ? [button('Назад', action(page - 1), command(page - 1))] : []),
    ...(length > (page + 1) * size
      ? [button('Далее', action(page + 1), command(page + 1))]
      : []),
  ];
}
export function classTextFallback(response: ClassResponse): string {
  return `${response.text}\n\nКнопки недоступны. Напишите нужную команду:\n${response.buttons.map((item) => `• ${item.label}: «${item.command}»`).join('\n')}`;
}
export function classFallbackMessages(response: ClassResponse): string[] {
  const text = classTextFallback(response);
  return text.length <= 4000
    ? [text]
    : [response.text, text.slice(response.text.length + 2)];
}
