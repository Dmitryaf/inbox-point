import * as React from 'react';
import { getCurrentScope, inject } from './model-state';
import { RouterContext, RouterKey } from './router-context';
import type { Router } from './router-types';

export function useRouter(): Router {
  if (getCurrentScope()) {
    const scoped = inject(RouterKey);
    if (!scoped) {
      throw new Error('RouterHost model scope is missing');
    }
    return scoped;
  }
  const router = React.useContext(RouterContext);
  if (!router) {
    throw new Error('RouterHost is missing');
  }
  return router;
}
export function useRoute() {
  const router = useRouter();
  return new Proxy(router.currentRoute.value, {
    get(_target, key): unknown {
      const value: unknown = Reflect.get(router.currentRoute.value, key);
      return value;
    },
  });
}
