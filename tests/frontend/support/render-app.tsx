import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter } from 'react-router';
import { afterEach } from 'vitest';

import { App } from '@frontend/app/App';
import { createAppQueryClient } from '@frontend/app/query-client';
import { adminRoutes } from '@frontend/app/router';

const routers: ReturnType<typeof createMemoryRouter>[] = [];
afterEach(() => {
  routers.splice(0).forEach((router) => router.dispose());
});

export function renderApp(path = '/manage') {
  const router = createMemoryRouter(adminRoutes, { initialEntries: [path] });
  const queryClient = createAppQueryClient();
  routers.push(router);
  const view = render(
    <StrictMode>
      <App router={router} queryClient={queryClient} />
    </StrictMode>,
  );
  return { ...view, router, queryClient };
}
