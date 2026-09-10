import type { ReactNode } from 'react';
import type { DataRouter, RouteObject } from 'react-router';
import { ref } from './model-state';
import { resolveRoute } from './router-state';
import type { NavigationGuard, ResolvedRoute, Router } from './router-types';

export function createRouterController(
  native: DataRouter,
  records: RouteObject[],
  content: ReactNode,
  render: (router: Router, children: ReactNode) => ReactNode,
): Router {
  const location = (): string =>
    native.state.location.pathname +
    native.state.location.search +
    native.state.location.hash;
  const currentRoute = ref(resolveRoute(records, location()));
  const before = new Set<NavigationGuard>();
  const after = new Set<(to: ResolvedRoute, from: ResolvedRoute) => void>();
  let active = false;
  let initialPublished = false;
  const publish = (to: ResolvedRoute, from: ResolvedRoute): void => {
    initialPublished = true;
    for (const hook of after) {
      hook(to, from);
    }
  };
  native.getBlocker('historical-navigation', ({ nextLocation }) => {
    const to = resolveRoute(
      records,
      nextLocation.pathname + nextLocation.search + nextLocation.hash,
    );
    return [...before].some((guard) => guard(to, currentRoute.value) === false);
  });
  native.subscribe((state) => {
    const to = resolveRoute(records, location());
    const from = currentRoute.value;
    if (to.fullPath !== from.fullPath) {
      currentRoute.value = to;
      if (state.initialized) {
        publish(to, from);
      }
    } else if (active && state.initialized && !initialPublished) {
      publish(to, from);
    }
  });
  const router: Router = {
    __reactRouter: true,
    native,
    records,
    currentRoute,
    rootContent: content,
    activate() {
      active = true;
      if (native.state.initialized && !initialPublished) {
        publish(currentRoute.value, currentRoute.value);
      }
    },
    async push(to) {
      await native.navigate(resolveRoute(records, to).fullPath);
    },
    async replace(to) {
      await native.navigate(resolveRoute(records, to).fullPath, {
        replace: true,
      });
    },
    async isReady() {
      if (native.state.initialized) {
        return;
      }
      await new Promise<void>((done) => {
        const unsubscribe = native.subscribe((state) => {
          if (state.initialized) {
            unsubscribe();
            done();
          }
        });
      });
    },
    beforeEach(guard) {
      before.add(guard);
      return () => before.delete(guard);
    },
    afterEach(guard) {
      after.add(guard);
      return () => after.delete(guard);
    },
    resolve(to) {
      return resolveRoute(records, to);
    },
    render(children) {
      return render(router, children);
    },
  };
  return router;
}
