import { mount } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';

import App from '@frontend/app/App.vue';
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
