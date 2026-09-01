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
      return this.content.schedule ?? 'Расписание ' + unavailableSuffix;
    }
    if (normalized === pricesButton) {
      return this.content.prices ?? 'Информация о ценах ' + unavailableSuffix;
    }
    if (normalized === addressButton) {
      return (
        this.content.address ?? 'Информация об адресе ' + unavailableSuffix
      );
    }
    return this.content.customSections?.find(
      (section) => section.label === normalized,
    )?.text;
  }
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
        section.label.length > 0 &&
        section.label.length <= 40 &&
        section.text.length > 0 &&
        section.text.length <= 4_000,
    ) &&
    new Set(normalizedLabels).size === normalizedLabels.length &&
    normalizedLabels.every((label) => !reserved.includes(label))
  );
}
