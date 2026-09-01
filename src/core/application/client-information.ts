export const scheduleButton = 'Расписание';
export const pricesButton = 'Цены';
export const addressButton = 'Адрес';
export const teacherButton = 'Задать вопрос преподавателю';

export const informationButtons = [
  scheduleButton,
  pricesButton,
  addressButton,
] as const;

const unavailableSuffix =
  'пока не добавлено. Вы можете задать вопрос преподавателю.';

export interface ClientInformationContent {
  address?: string;
  prices?: string;
  schedule?: string;
}

export interface ClientInformationResolver {
  resolve(text: string): string | undefined;
}

export class ClientInformationCatalog implements ClientInformationResolver {
  private content: ClientInformationContent;

  public constructor(content: ClientInformationContent = {}) {
    this.content = { ...content };
  }

  public getContent(): ClientInformationContent {
    return { ...this.content };
  }

  public replace(content: ClientInformationContent): void {
    this.content = { ...content };
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
    return undefined;
  }
}
