import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';

import { SessionProvider } from '@frontend/features/admin-auth/model/SessionProvider';
import type { createAdminRouter } from './router';

export function App({
  router,
  queryClient,
}: {
  router: ReturnType<typeof createAdminRouter>;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  );
}
