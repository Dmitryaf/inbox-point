export const scheduleButton = 'Расписание';
export const pricesButton = 'Цены';
export const addressButton = 'Адрес';
export const faqButton = 'Частые вопросы';
export const teacherButton = 'Задать вопрос преподавателю';
export const newQuestionButton = 'Начать новый вопрос';
export const clientMessageLengthLimit = 4_000;

export const informationButtons = [
  scheduleButton,
  pricesButton,
  addressButton,
  faqButton,
] as const;

export const informationSectionIds = [
  'schedule',
  'prices',
  'address',
  'faq',
] as const;

export type InformationSectionId = (typeof informationSectionIds)[number];

export const reservedClientLabels = [
  ...informationButtons,
  teacherButton,
  newQuestionButton,
  '/start',
  '/menu',
  'Начать',
  'FAQ',
] as const;

const unavailableSuffix =
  'пока не добавлено. Вы можете задать вопрос преподавателю.';

export interface ClientInformationContent {
  address?: string;
  customSections?: readonly CustomInformationSection[];
  faq?: readonly FaqItem[];
  prices?: string;
  schedule?: string;
  visibleSections?: readonly InformationSectionId[];
}

export interface CustomInformationSection {
  label: string;
  text: string;
}

export interface FaqItem {
  answer: string;
  question: string;
}

export interface ClientInformationResolver {
  getInformationButtons(): readonly string[];
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

  public getInformationButtons(): readonly string[] {
    const buttons: string[] = [];
    if (
      this.content.schedule?.trim() &&
      isInformationSectionVisible(this.content, 'schedule')
    ) {
      buttons.push(scheduleButton);
    }
    if (
      this.content.prices?.trim() &&
      isInformationSectionVisible(this.content, 'prices')
    ) {
      buttons.push(pricesButton);
    }
    if (
      this.content.address?.trim() &&
      isInformationSectionVisible(this.content, 'address')
    ) {
      buttons.push(addressButton);
    }
    if (
      this.content.faq?.length &&
      isInformationSectionVisible(this.content, 'faq')
    ) {
      buttons.push(faqButton);
    }
    return buttons;
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
    if (normalized === faqButton || normalized.toLowerCase() === 'faq') {
      return this.content.faq?.length
        ? formatFaqResponse(this.content.faq)
        : 'Частые вопросы пока не добавлены. Вы можете задать вопрос преподавателю.';
    }
    const section = this.content.customSections?.find(
      (section) => section.label === normalized,
    );
    if (!section) {
      return undefined;
    }
    return section.text;
  }
}

export function formatFaqResponse(items: readonly FaqItem[]): string {
  return `${faqButton}\n\n${items
    .map((item) => `❓ ${item.question}\n${item.answer}`)
    .join('\n\n────────\n\n')}`;
}

export function hasValidFaqItems(items: readonly FaqItem[]): boolean {
  return (
    items.length <= 20 &&
    items.every(
      (item) =>
        item.question === item.question.trim() &&
        item.answer === item.answer.trim() &&
        item.question.length > 0 &&
        item.question.length <= 300 &&
        item.answer.length > 0 &&
        item.answer.length <= 3_000,
    ) &&
    (items.length === 0 ||
      formatFaqResponse(items).length <= clientMessageLengthLimit)
  );
}

export function hasValidClientInformationResponses(
  content: ClientInformationContent,
): boolean {
  const responses = [
    content.schedule
      ? formatListResponse(scheduleButton, content.schedule)
      : undefined,
    content.prices
      ? formatListResponse(pricesButton, content.prices)
      : undefined,
    content.address ? `${addressButton}\n\n${content.address}` : undefined,
    content.faq?.length ? formatFaqResponse(content.faq) : undefined,
    ...(content.customSections?.map((section) => section.text) ?? []),
  ];

  return responses.every(
    (response) =>
      response === undefined || response.length <= clientMessageLengthLimit,
  );
}

function formatListResponse(label: string, text: string): string {
  const items = text
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);
  return `${label}\n\n${items.map((item) => `• ${item}`).join('\n')}`;
}

function copyContent(
  content: ClientInformationContent,
): ClientInformationContent {
  if (!hasValidCustomSections(content.customSections ?? [])) {
    throw new Error('Invalid custom information sections');
  }
  if (!hasValidFaqItems(content.faq ?? [])) {
    throw new Error('Invalid FAQ items');
  }
  if (!hasValidClientInformationResponses(content)) {
    throw new Error('Client information response is too long');
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
    ...(content.faq ? { faq: content.faq.map((item) => ({ ...item })) } : {}),
    ...(content.visibleSections
      ? { visibleSections: [...content.visibleSections] }
      : {}),
  };
}

export function isInformationSectionVisible(
  content: ClientInformationContent,
  section: InformationSectionId,
): boolean {
  return content.visibleSections?.includes(section) ?? true;
}

export function hasValidCustomSections(
  sections: readonly CustomInformationSection[],
): boolean {
  if (sections.length > 6) {
    return false;
  }
  const reserved = reservedClientLabels.map((label) => label.toLowerCase());
  const normalizedLabels = sections.map((section) =>
    section.label.trim().toLowerCase(),
  );
  return (
    sections.every(
      (section) =>
        section.label === section.label.trim() &&
        section.text === section.text.trim() &&
        section.label.length > 0 &&
        section.label.length <= 40 &&
        section.text.length > 0 &&
        section.text.length <= 4_000,
    ) &&
    new Set(normalizedLabels).size === normalizedLabels.length &&
    normalizedLabels.every((label) => !reserved.includes(label))
  );
}
