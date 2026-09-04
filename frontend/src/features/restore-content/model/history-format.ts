const sectionNames: Record<string, string> = {
  address: 'адрес',
  customSections: 'дополнительные разделы',
  faq: 'частые вопросы',
  prices: 'цены',
  schedule: 'расписание',
};

export function formatSections(sections: string[]): string {
  return sections.map((section) => sectionNames[section] ?? section).join(', ');
}

export function formatChangeDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
