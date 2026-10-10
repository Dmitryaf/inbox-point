export interface ClassDirection {
  id: string;
  name: string;
}
export interface ClassGroup {
  review?: { source: string } | undefined;
  id: string;
  directionId: string;
  name: string;
  meetings: string[];
  description: string;
  enrollmentOpen: boolean;
  applicationQuestion: string;
}
export interface ClassKeyword {
  phrase: string;
  targetType: 'direction' | 'group';
  targetId: string;
}
export interface ClassContent {
  directions?: readonly ClassDirection[] | undefined;
  groups?: readonly ClassGroup[] | undefined;
  keywords?: readonly ClassKeyword[] | undefined;
  customSections?: readonly { label: string }[] | undefined;
}

export const classActionLabels = [
  'Записаться на занятие',
  'Расписание группы',
  'Расписание всех направлений',
  'Другие направления',
  'Другие занятия',
  'Далее',
  'Назад',
];
export const defaultApplicationQuestion = 'В какой день хотите прийти?';
export function normalizeApplicationQuestion(question: string): string {
  return question.trim() ===
    'Как к вам обращаться и на какое занятие планируете прийти?'
    ? defaultApplicationQuestion
    : question;
}
export function normalizeKeyword(text: string): string {
  return text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('ru');
}
export function groupTitle(content: ClassContent, group: ClassGroup): string {
  return `${content.directions?.find((item) => item.id === group.directionId)?.name ?? ''} / ${group.name}`;
}
export function copyClassContent(content: ClassContent): {
  directions?: ClassDirection[];
  groups?: ClassGroup[];
  keywords?: ClassKeyword[];
} {
  return {
    ...(content.directions
      ? { directions: content.directions.map((item) => ({ ...item })) }
      : {}),
    ...(content.groups
      ? {
          groups: content.groups.map((item) => ({
            ...item,
            ...(item.review ? { review: { ...item.review } } : {}),
            meetings: [...item.meetings],
          })),
        }
      : {}),
    ...(content.keywords
      ? { keywords: content.keywords.map((item) => ({ ...item })) }
      : {}),
  };
}
export function classContentIssue(
  content: ClassContent,
  reserved: readonly string[],
): string | undefined {
  const directions = content.directions ?? [];
  const groups = content.groups ?? [];
  const keywords = content.keywords ?? [];
  const validId = (id: string) => /^[A-Za-z0-9_-]{1,36}$/u.test(id);
  const validName = (name: string) =>
    name === name.trim() &&
    name.length > 0 &&
    name.length <= 80 &&
    !/[\r\n/:]/u.test(name);
  if (
    directions.length > 20 ||
    groups.filter((group) => !group.review).length > 60 ||
    groups.length > 81 ||
    keywords.length > 40
  ) {
    return 'Можно добавить до 20 направлений, 60 групп и 40 ключевых слов.';
  }
  if (
    directions.some((item) => !validId(item.id) || !validName(item.name)) ||
    new Set(directions.map((item) => item.id)).size !== directions.length ||
    new Set(directions.map((item) => normalizeKeyword(item.name))).size !==
      directions.length
  ) {
    return 'Заполните разные названия направлений (до 80 символов, без / и :).';
  }
  if (
    groups.some(
      (group) =>
        !validId(group.id) ||
        (!group.review &&
          (!validName(group.name) ||
            !directions.some((item) => item.id === group.directionId))) ||
        (group.review !== undefined &&
          (!group.review.source ||
            group.review.source.length > 6000 ||
            group.enrollmentOpen)) ||
        typeof group.enrollmentOpen !== 'boolean' ||
        (!group.review && group.meetings.length < 1) ||
        group.meetings.length > 7 ||
        group.meetings.some(
          (time) =>
            !time.trim() ||
            time !== time.trim() ||
            time.length > 120 ||
            /[\r\n]/u.test(time),
        ) ||
        group.description !== group.description.trim() ||
        group.description.length > 1000 ||
        group.applicationQuestion !== group.applicationQuestion.trim() ||
        group.applicationQuestion.length > 1000,
    ) ||
    new Set(groups.map((item) => item.id)).size !== groups.length ||
    new Set(
      groups
        .filter((group) => !group.review)
        .map((item) => `${item.directionId}:${normalizeKeyword(item.name)}`),
    ).size !== groups.filter((group) => !group.review).length
  ) {
    return 'Для каждой группы выберите направление, укажите своё название и от 1 до 7 дней и времени занятий. Описание и вопрос — до 1000 символов.';
  }
  const forbidden = new Set(
    [
      ...reserved,
      ...classActionLabels,
      ...(content.customSections?.map((item) => item.label) ?? []),
    ].map(normalizeKeyword),
  );
  const phrases = keywords.map((item) => normalizeKeyword(item.phrase));
  if (new Set(phrases).size !== phrases.length) {
    return 'Это ключевое слово уже используется. Регистр и лишние пробелы не учитываются.';
  }
  if (
    keywords.some(
      (item) =>
        !normalizeKeyword(item.phrase) ||
        item.phrase.length > 80 ||
        forbidden.has(normalizeKeyword(item.phrase)) ||
        /[/:\r\n]/u.test(item.phrase) ||
        !(
          item.targetType === 'direction'
            ? directions
            : item.targetType === 'group'
              ? groups
              : []
        ).some((target) => target.id === item.targetId),
    )
  ) {
    return 'Для ключевого слова выберите существующее направление или группу. Слова кнопок и команды использовать нельзя.';
  }
  return undefined;
}
