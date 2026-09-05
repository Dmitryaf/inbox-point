import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage';
import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage';
import SetupPage from '@frontend/pages/setup/ui/SetupPage';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const currentPage = computed(() => {
    if (window.location.pathname.startsWith('/ops')) {
      return OperationsDashboardPage;
    }
    if (window.location.pathname.startsWith('/setup')) {
      return SetupPage;
    }
    return ContentManagementPage;
  });
  return { currentPage };
}
