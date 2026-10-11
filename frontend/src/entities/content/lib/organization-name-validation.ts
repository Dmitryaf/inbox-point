export function organizationNameIssue(
  value: string | undefined,
): string | undefined {
  if ((value?.trim().length ?? 0) > 120 || /[\r\n]/u.test(value ?? '')) {
    return 'Название организации должно быть в одну строку, не длиннее 120 символов.';
  }
  return undefined;
}
