import {
  classContentIssue,
  copyClassContent,
  type ClassContent,
} from '@/core/application/class-content.js';

import {
  formatScheduleCompatibilityResponse,
  formatScheduleResponse,
  scheduleResponseTitle,
  type ScheduleItem,
} from '@/core/application/schedule-response.js';

export { formatScheduleResponse } from '@/core/application/schedule-response.js';
export type { ScheduleItem } from '@/core/application/schedule-response.js';

export const scheduleButton = scheduleResponseTitle;
export const pricesButton = 'Цены';
export const addressButton = 'Адрес';
export const faqButton = 'Частые вопросы';
export const handoffButton = 'Задать вопрос';
export const newQuestionButton = 'Начать новый вопрос';
export const clientMessageLengthLimit = 4_000;
export const scheduleItemLimit = 20;
export const scheduleTitleLengthLimit = 120;
export const scheduleDayTimeLengthLimit = 120;
export const scheduleDescriptionLengthLimit = 1_000;

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
  'Меню',
] as const;

export interface ClientInformationContent extends ClassContent {
  address?: string;
  customSections?: readonly CustomInformationSection[];
  faq?: readonly FaqItem[];
  prices?: string;
  legacySchedule?: string;
  schedule?: readonly ScheduleItem[];
  visibleSections?: readonly InformationSectionId[];
}

export interface CustomInformationSection {
  mode?: 'information' | 'application';
  id?: string;
  label: string;
  text: string;
}

export interface FaqItem {
  answer: string;
  question: string;
}

export interface ClientInformationResolver {
  getContent?(): ClientInformationContent;
  getInformationButtons(): readonly string[];
  getCustomSections(): readonly CustomInformationSection[];
  isStaleMenuAction(text: string): boolean;
  resolve(text: string): string | undefined;
}

export interface MenuAction {
  key: string;
  label: string;
}

export function resolveMenuAction(
  information: ClientInformationResolver,
  text: string,
): MenuAction | undefined {
  const label = text.trim();
  const standard = [
    ...informationSectionIds.map((key, index) => ({
      key,
      label: informationButtons[index] ?? '',
    })),
    { key: 'handoff', label: handoffButton },
    { key: 'new_question', label: newQuestionButton },
  ].find((action) => action.label === label);
  if (standard) {
    return standard;
  }
  const custom = information
    .getCustomSections()
    .find((section) => section.label === label);
  return custom?.id
    ? { key: `custom:${custom.id}`, label: custom.label }
    : undefined;
}

export function resolveMenuActionByKey(
  information: ClientInformationResolver,
  key: string,
): MenuAction | undefined {
  return [
    ...informationButtons,
    handoffButton,
    newQuestionButton,
    ...information.getCustomSections().map((section) => section.label),
  ]
    .map((label) => resolveMenuAction(information, label))
    .find((action) => action?.key === key);
}

export class ClientInformationCatalog implements ClientInformationResolver {
  private content: ClientInformationContent;
  private historicalMenuActions: readonly string[];

  public constructor(
    content: ClientInformationContent = {},
    historicalMenuActions: readonly string[] = [],
  ) {
    this.content = identifyCatalogContent(content);
    this.historicalMenuActions = [...historicalMenuActions];
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
    return getInformationButtonValues(this.content);
  }

  public initialize(
    content: ClientInformationContent,
    historicalMenuActions: readonly string[] = [],
  ): void {
    this.content = identifyCatalogContent(content);
    this.historicalMenuActions = [...historicalMenuActions];
  }

  public replace(
    content: ClientInformationContent,
    historicalMenuActions: readonly string[] = [],
  ): void {
    this.content = identifyCatalogContent(content, this.content);
    this.historicalMenuActions = [...historicalMenuActions];
  }

  public isStaleMenuAction(text: string): boolean {
    const normalized = text.trim();
    return (
      this.historicalMenuActions.includes(normalized) &&
      !getMenuActionValues(this.content).includes(normalized)
    );
  }

  public resolve(text: string): string | undefined {
    const normalized = text.trim();
    if (normalized === scheduleButton) {
      return this.content.schedule?.length
        ? formatScheduleResponse(this.content.schedule)
        : this.content.legacySchedule
          ? formatListResponse(scheduleButton, this.content.legacySchedule)
          : 'Расписание пока не указано.';
    }
    if (normalized === pricesButton) {
      return this.content.prices
        ? formatListResponse('Цены', this.content.prices)
        : 'Цены пока не указаны.';
    }
    if (normalized === addressButton) {
      return this.content.address
        ? `Адрес\n\n${this.content.address}`
        : 'Адрес пока не указан.';
    }
    if (normalized === faqButton) {
      return this.content.faq?.length
        ? formatFaqResponse(this.content.faq)
        : 'Раздел с частыми вопросами пока пуст.';
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

function identifyCatalogContent(
  content: ClientInformationContent,
  previous: ClientInformationContent = {},
): ClientInformationContent {
  const copy = copyClientInformationContent(content);
  if (copy.customSections) {
    copy.customSections = copy.customSections.map((section) => ({
      ...section,
      id:
        section.id ??
        previous.customSections?.find(
          (candidate) => candidate.label === section.label,
        )?.id ??
        crypto.randomUUID(),
    }));
  }
  return copy;
}

export function getMenuActionValues(
  content: ClientInformationContent,
): readonly string[] {
  return [
    ...getInformationButtonValues(content),
    ...(content.customSections?.map((section) => section.label) ?? []),
  ];
}

function getInformationButtonValues(
  content: ClientInformationContent,
): readonly string[] {
  const buttons: string[] = [];
  if (
    hasScheduleContent(content) &&
    isInformationSectionVisible(content, 'schedule')
  ) {
    buttons.push(scheduleButton);
  }
  if (
    content.prices?.trim() &&
    isInformationSectionVisible(content, 'prices')
  ) {
    buttons.push(pricesButton);
  }
  if (
    content.address?.trim() &&
    isInformationSectionVisible(content, 'address')
  ) {
    buttons.push(addressButton);
  }
  if (content.faq?.length && isInformationSectionVisible(content, 'faq')) {
    buttons.push(faqButton);
  }
  return buttons;
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

export function hasValidScheduleItems(items: readonly ScheduleItem[]): boolean {
  return (
    items.length <= scheduleItemLimit &&
    items.every(
      (item) =>
        item.title === item.title.trim() &&
        item.dayTime === item.dayTime.trim() &&
        !/[\r\n]/u.test(item.title) &&
        !/[\r\n]/u.test(item.dayTime) &&
        (item.description === undefined ||
          item.description === item.description.trim()) &&
        item.title.length > 0 &&
        item.title.length <= scheduleTitleLengthLimit &&
        item.dayTime.length > 0 &&
        item.dayTime.length <= scheduleDayTimeLengthLimit &&
        (item.description?.length ?? 0) <= scheduleDescriptionLengthLimit,
    ) &&
    (items.length === 0 ||
      (formatScheduleResponse(items).length <= clientMessageLengthLimit &&
        formatScheduleCompatibilityResponse(items).length <=
          clientMessageLengthLimit))
  );
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
    content.schedule?.length
      ? formatScheduleResponse(content.schedule)
      : content.legacySchedule
        ? formatListResponse(scheduleButton, content.legacySchedule)
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

export function formatListResponse(label: string, text: string): string {
  const items = text
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);
  return `${label}\n\n${items.map((item) => `• ${item}`).join('\n')}`;
}

export function copyClientInformationContent(
  content: ClientInformationContent,
): ClientInformationContent {
  const issue = classContentIssue(content, reservedClientLabels);
  if (issue) {
    throw new Error(issue);
  }
  if (!hasValidCustomSections(content.customSections ?? [])) {
    throw new Error('Invalid custom information sections');
  }
  if (!hasValidFaqItems(content.faq ?? [])) {
    throw new Error('Invalid FAQ items');
  }
  if (
    !hasValidScheduleItems(content.schedule ?? []) ||
    (content.schedule?.length && content.legacySchedule)
  ) {
    throw new Error('Invalid schedule items');
  }
  if (!hasValidClientInformationResponses(content)) {
    throw new Error('Client information response is too long');
  }
  return {
    ...content,
    ...copyClassContent(content),
    ...(content.customSections
      ? {
          customSections: content.customSections.map((section) => ({
            ...section,
          })),
        }
      : {}),
    ...(content.faq ? { faq: content.faq.map((item) => ({ ...item })) } : {}),
    ...(content.schedule
      ? { schedule: content.schedule.map((item) => ({ ...item })) }
      : {}),
    ...(content.visibleSections
      ? { visibleSections: [...content.visibleSections] }
      : {}),
  };
}

function hasScheduleContent(content: ClientInformationContent): boolean {
  return [
    content.directions?.length,
    content.schedule?.length,
    content.legacySchedule?.trim(),
  ].some(Boolean);
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
        (section.mode === undefined ||
          section.mode === 'information' ||
          section.mode === 'application') &&
        (section.id === undefined ||
          /^[A-Za-z0-9_-]{1,80}$/u.test(section.id)) &&
        section.label === section.label.trim() &&
        section.text === section.text.trim() &&
        section.label.length > 0 &&
        section.label.length <= 40 &&
        section.text.length > 0 &&
        section.text.length <= 4_000,
    ) &&
    new Set(normalizedLabels).size === normalizedLabels.length &&
    new Set(sections.flatMap((section) => (section.id ? [section.id] : [])))
      .size === sections.filter((section) => section.id !== undefined).length &&
    normalizedLabels.every((label) => !reserved.includes(label))
  );
}
