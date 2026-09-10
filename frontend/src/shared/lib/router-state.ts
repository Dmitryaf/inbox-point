import { matchRoutes } from 'react-router';
import type { RouteObject } from 'react-router';
import type { ResolvedRoute, RouteTarget, RouteMeta } from './router-types';

function mergeRouteMeta(target: RouteMeta, source: object): void {
  const entries: [string, unknown][] = Object.entries(source);
  for (const [key, value] of entries) {
    if (
      ['documentTitle', 'pageTitle', 'description'].includes(key) &&
      value !== undefined &&
      typeof value !== 'string'
    ) {
      throw new TypeError(`Route metadata ${key} must be a string`);
    }
    if (
      key === 'adminSection' &&
      value !== undefined &&
      !['answers', 'channels', 'monitoring'].some(
        (section) => section === value,
      )
    ) {
      throw new TypeError('Unknown administrative route section');
    }
    target[key] = value;
  }
}

export function resolveRoute(
  records: RouteObject[],
  target: RouteTarget,
): ResolvedRoute {
  let value: string;
  if (typeof target === 'string') {
    value = target;
  } else {
    const query = new URLSearchParams();
    for (const [key, entry] of Object.entries(target.query ?? {})) {
      if (entry !== undefined) {
        query.set(key, String(entry));
      }
    }
    if (target.name && !target.path) {
      throw new Error('Named navigation needs an explicit historical port');
    }
    value =
      (target.path ?? '/') +
      (query.size ? '?' + query.toString() : '') +
      (target.hash ?? '');
  }
  const url = new URL(value, 'http://localhost');
  const matches = matchRoutes(records, url.pathname) ?? [];
  const meta: RouteMeta = {};
  let name: string | undefined;
  for (const match of matches) {
    const handle: unknown = match.route.handle;
    if (handle && typeof handle === 'object') {
      const routeMeta: unknown = Reflect.get(handle, 'meta');
      if (routeMeta && typeof routeMeta === 'object') {
        mergeRouteMeta(meta, routeMeta);
      }
      const routeName: unknown = Reflect.get(handle, 'name');
      if (typeof routeName === 'string') {
        name = routeName;
      }
    }
  }
  const query: ResolvedRoute['query'] = {};
  for (const key of new Set(url.searchParams.keys())) {
    const entries = url.searchParams.getAll(key);
    query[key] = entries.length > 1 ? entries : (entries[0] ?? '');
  }
  return {
    path: url.pathname,
    fullPath: url.pathname + url.search + url.hash,
    ...(name === undefined ? {} : { name }),
    meta,
    query,
    hash: url.hash,
  };
}
