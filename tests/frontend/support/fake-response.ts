export interface FakeResponse {
  json(): Promise<unknown>;
  ok: boolean;
  status: number;
}

export function response(body: unknown, status = 200): FakeResponse {
  return {
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status,
  };
}

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}
