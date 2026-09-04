export function createSessionCookie(
  name: string,
  value: string,
  maxAge: number,
  secure: boolean,
): string {
  return [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function readCookie(
  header: string | undefined,
  expectedName: string,
): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name === expectedName) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}
