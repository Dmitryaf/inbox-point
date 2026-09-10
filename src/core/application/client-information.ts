export const scheduleButton = 'Расписание';
export const pricesButton = 'Цены';
export const addressButton = 'Адрес';
export const faqButton = 'Частые вопросы';
export const handoffButton = 'Задать вопрос';
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
  handoffButton,
  newQuestionButton,
  '/start',
  '/menu',
  'Начать',
] as const;

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
    this.content = copyClientInformationContent(content);
  }

  public getContent(): ClientInformationContent {
    return copyClientInformationContent(this.content);
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
    this.content = copyClientInformationContent(content);
  }

  public resolve(text: string): string | undefined {
    const normalized = text.trim();
    if (normalized === scheduleButton) {
      return this.content.schedule
        ? formatListResponse('Расписание', this.content.schedule)
        : 'Расписание пока не добавлено. Задайте вопрос, чтобы уточнить время.';
    }
    if (normalized === pricesButton) {
      return this.content.prices
        ? formatListResponse('Цены', this.content.prices)
        : 'Информация о ценах пока не добавлена. Задайте вопрос, чтобы уточнить стоимость.';
    }
    if (normalized === addressButton) {
      return this.content.address
        ? `Адрес\n\n${this.content.address}`
        : 'Адрес пока не добавлен. Задайте вопрос, чтобы уточнить детали.';
    }
    if (normalized === faqButton) {
      return this.content.faq?.length
        ? formatFaqResponse(this.content.faq)
        : 'Частые вопросы пока не добавлены. Задайте вопрос, если нужна помощь.';
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

export function isHandoffRequest(text: string): boolean {
  return text.trim() === handoffButton;
}

export function isAvailableInformationRequest(
  information: ClientInformationResolver,
  text: string,
): boolean {
  const normalized = text.trim();
  if (information.getInformationButtons().includes(normalized)) {
    return true;
  }
  return information
    .getCustomSections()
    .some((section) => section.label === normalized);
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

export function copyClientInformationContent(
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
