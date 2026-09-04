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
  const { props: $props, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <ContentManagementPage {...$attributes} />
    </ModelScopeProvider>
  );
}
