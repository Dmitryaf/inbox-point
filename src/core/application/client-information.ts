export const scheduleButton = 'Расписание';
export const pricesButton = 'Цены';
export const addressButton = 'Адрес';
export const teacherButton = 'Задать вопрос преподавателю';
export const newQuestionButton = 'Начать новый вопрос';

export const informationButtons = [
  scheduleButton,
  pricesButton,
  addressButton,
] as const;

export const reservedClientLabels = [
  ...informationButtons,
  teacherButton,
  newQuestionButton,
  '/start',
  '/menu',
  'Начать',
] as const;

const unavailableSuffix =
  'пока не добавлено. Вы можете задать вопрос преподавателю.';

export interface ClientInformationContent {
  address?: string;
  customSections?: readonly CustomInformationSection[];
  prices?: string;
  schedule?: string;
}

export interface CustomInformationSection {
  format?: 'faq';
  label: string;
  text: string;
}

export interface ClientInformationResolver {
  getCustomSections(): readonly CustomInformationSection[];
  resolve(text: string): string | undefined;
}

export class ClientInformationCatalog implements ClientInformationResolver {
  private content: ClientInformationContent;

  public constructor(content: ClientInformationContent = {}) {
    this.content = copyContent(content);
  }

  public getContent(): ClientInformationContent {
    return copyContent(this.content);
  }

  public getCustomSections(): readonly CustomInformationSection[] {
    return (
      this.content.customSections?.map((section) => ({ ...section })) ?? []
    );
  }

  public replace(content: ClientInformationContent): void {
    this.content = copyContent(content);
  }

  public resolve(text: string): string | undefined {
    const normalized = text.trim();
    if (normalized === scheduleButton) {
      return this.content.schedule
        ? formatListResponse('Расписание', this.content.schedule)
        : 'Расписание ' + unavailableSuffix;
    }
    if (normalized === pricesButton) {
      return this.content.prices
        ? formatListResponse('Цены', this.content.prices)
        : 'Информация о ценах ' + unavailableSuffix;
    }
    if (normalized === addressButton) {
      return this.content.address
        ? `Адрес\n\n${this.content.address}`
        : 'Информация об адресе ' + unavailableSuffix;
    }
    const section = this.content.customSections?.find(
      (section) => section.label === normalized,
    );
    if (!section) return undefined;
    return section.format === 'faq'
      ? formatFaqResponse(section.label, section.text)
      : section.text;
  }
}

export function formatFaqResponse(label: string, text: string): string {
  return `${label}\n\n${parseFaqItems(text)
    .map((item) => `❓ ${item.question}\n${item.answer}`)
    .join('\n\n────────\n\n')}`;
}

export function hasValidFaqText(text: string): boolean {
  const items = parseFaqItems(text);
  return items.length > 0 && items.every((item) => item.answer.length > 0);
}

function formatListResponse(label: string, text: string): string {
  const items = text
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);
  return `${label}\n\n${items.map((item) => `• ${item}`).join('\n')}`;
}

function parseFaqItems(
  text: string,
): readonly { answer: string; question: string }[] {
  return text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => {
      const [question = '', ...answer] = block
        .split(/\r?\n/)
        .map((line) => line.trim());
      return {
        answer: answer.filter(Boolean).join('\n'),
        question,
      };
    })
    .filter((item) => item.question.length > 0);
}

function copyContent(
  content: ClientInformationContent,
): ClientInformationContent {
  if (!hasValidCustomSections(content.customSections ?? [])) {
    throw new Error('Invalid custom information sections');
  }
  return {
    ...content,
    ...(content.customSections
      ? {
          customSections: content.customSections.map((section) => ({
            ...section,
          })),
        }
      : {}),
  };
}

export function hasValidCustomSections(
  sections: readonly CustomInformationSection[],
): boolean {
  if (sections.length > 6) return false;
  const reserved = reservedClientLabels.map((label) => label.toLowerCase());
  const normalizedLabels = sections.map((section) =>
    section.label.trim().toLowerCase(),
  );
  return (
    sections.every(
      (section) =>
        section.label === section.label.trim() &&
        section.text === section.text.trim() &&
        (section.format === undefined || section.format === 'faq') &&
        (section.format !== 'faq' || hasValidFaqText(section.text)) &&
        section.label.length > 0 &&
        section.label.length <= 40 &&
        section.text.length > 0 &&
        section.text.length <= 4_000,
    ) &&
    new Set(normalizedLabels).size === normalizedLabels.length &&
    normalizedLabels.every((label) => !reserved.includes(label))
  );
}
