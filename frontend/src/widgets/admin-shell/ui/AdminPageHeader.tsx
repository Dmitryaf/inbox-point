import '@frontend/widgets/admin-shell/styles/admin-page-header.react-data-r-e15afcb7.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderAdminPageHeaderPart1 } from './AdminPageHeader.part1';
import { renderAdminPageHeaderPart2 } from './AdminPageHeader.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './AdminPageHeader.model';
export type { AdminSection } from './AdminPageHeader.model';
export default function AdminPageHeader($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <header
        {...$attributes}
        className={$class('admin-header', $attributes.className)}
        data-r-e15afcb7=""
      >
        {renderAdminPageHeaderPart1($state, $props)}
        <p className="page-intro" data-r-e15afcb7="">
          {$props.intro}
        </p>
        {renderAdminPageHeaderPart2($state, $props)}
      </header>
    </ModelScopeProvider>
  );
}
