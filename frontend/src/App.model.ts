import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage';
import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const currentPage = computed(() => {
    if (window.location.pathname.startsWith('/ops')) {
      return OperationsDashboardPage;
    }
    return ContentManagementPage;
  });
  return { currentPage };
}
