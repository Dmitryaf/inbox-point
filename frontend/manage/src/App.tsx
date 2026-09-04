import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';

import { inheritedAttributes } from '@manage/shared/lib/component-attributes';
import ContentManagementPage from '@manage/pages/content-management/ui/ContentManagementPage';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './App.model';

export default function App($incomingProps: ComponentProps) {
  const $attributes = inheritedAttributes($incomingProps);
  const { scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  return (
    <ModelScopeProvider scope={$scope}>
      <ContentManagementPage {...$attributes} />
    </ModelScopeProvider>
  );
}
