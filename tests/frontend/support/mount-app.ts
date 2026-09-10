import { mount } from '@test/frontend/support/react-test-utils';
import { createMemoryHistory } from '@frontend/shared/lib/router';

import App from '@frontend/app/App';
import { createAdminRouter } from '@frontend/app/router';

export async function mountAppAt(path: string) {
  const router = createAdminRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();
  return {
    router,
    wrapper: mount(App, { global: { plugins: [router] } }),
  };
}
