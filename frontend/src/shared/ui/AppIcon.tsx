import '@frontend/shared/styles/app-icon.react-data-r-5d93b4d9.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderAppIconPart1 } from './AppIcon.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './AppIcon.model';
export type { AppIconName } from './AppIcon.model';
export default function AppIcon($incomingProps: ComponentProps) {
  const { props: $props, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <svg
        {...$attributes}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        aria-hidden="true"
        className={$class('app-icon', $attributes.className)}
        data-r-5d93b4d9=""
      >
        {renderAppIconPart1($props)}
      </svg>
    </ModelScopeProvider>
  );
}
