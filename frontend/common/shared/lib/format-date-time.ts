const shortDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const shortDateTimeWithSecondsFormatter = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'medium',
});

export function formatShortDateTime(value: string): string {
  return shortDateTimeFormatter.format(new Date(value));
}

export function formatShortDateTimeWithSeconds(value: string): string {
  return shortDateTimeWithSecondsFormatter.format(new Date(value));
}
