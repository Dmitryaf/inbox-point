import * as React from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  Outlet,
  RouterProvider,
  redirect,
} from 'react-router';
import type { RouteObject } from 'react-router';
import { createModelScope } from './model-state';
import { createRouterController } from './router-controller';
import { ModelScopeProvider } from './component-model';
import { RouteProps, RouterContext, RouterKey } from './router-view';
import type { Router, RouterHistory, RouteRecordRaw } from './router-types';
export type { Router, RouterHistory, RouteRecordRaw } from './router-types';
export { RouterLink, RouterView, useRoute, useRouter } from './router-view';

export function createWebHistory(base?: string): RouterHistory {
  return { kind: 'browser', ...(base ? { base } : {}) };
}
export function createMemoryHistory(base?: string): RouterHistory {
  return { kind: 'memory', ...(base ? { base } : {}) };
}
function RouteElement({ record }: { record: RouteRecordRaw }) {
  const props = React.useContext(RouteProps);
  return record.component ? (
    React.createElement(record.component, props)
  ) : (
    <Outlet />
  );
}
function routeObjects(records: RouteRecordRaw[]): RouteObject[] {
  return records.map((record) => ({
    path: record.path === '/:pathMatch(.*)*' ? '*' : record.path,
    element: <RouteElement record={record} />,
    handle: { name: record.name, meta: record.meta },
    ...(record.redirect
      ? {
          loader: ({ request }: { request: Request }) => {
            return new URL(request.url).pathname === record.path
              ? redirect(record.redirect ?? '/')
              : null;
          },
        }
      : {}),
    ...(record.children ? { children: routeObjects(record.children) } : {}),
  }));
}
function RootContent({ getRouter }: { getRouter: () => Router }) {
  return getRouter().rootContent;
}
export function RouterHost({
  router,
  children,
}: {
  router: Router;
  children: React.ReactNode;
}) {
  const scope = React.useMemo(() => {
    const value = createModelScope();
    value.provided.set(RouterKey, router);
    return value;
  }, [router]);
  router.rootContent = children;
  React.useLayoutEffect(() => {
    router.activate();
  }, [router]);
  return (
    <ModelScopeProvider scope={scope}>
      <RouterContext.Provider value={router}>
        <RouterProvider router={router.native} />
      </RouterContext.Provider>
    </ModelScopeProvider>
  );
}
export function createRouter({
  history,
  routes,
}: {
  history: RouterHistory;
  routes: RouteRecordRaw[];
}): Router {
  const records = routeObjects(routes);
  const nativeRoutes: RouteObject[] = [
    {
      path: '/',
      element: <RootContent getRouter={() => router} />,
      hydrateFallbackElement: <RootContent getRouter={() => router} />,
      children: records,
    },
  ];
  const options = history.base ? { basename: history.base } : {};
  const native =
    history.kind === 'browser'
      ? createBrowserRouter(nativeRoutes, options)
      : createMemoryRouter(nativeRoutes, options);
  const router = createRouterController(
    native,
    records,
    <Outlet />,
    (value, children) => <RouterHost router={value}>{children}</RouterHost>,
  );
  return router;
}
