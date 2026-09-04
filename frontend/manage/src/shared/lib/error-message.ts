export function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : 'Что-то пошло не так. Попробуйте ещё раз.';
}
