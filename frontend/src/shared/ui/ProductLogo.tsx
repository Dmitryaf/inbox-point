import '@frontend/shared/styles/product-logo.react-data-r-f7705ee3.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderProductLogoPart1 } from './ProductLogo.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ProductLogo.model';

export default function ProductLogo($incomingProps: ComponentProps) {
  const { props: $props, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <span
        {...$attributes}
        className={$class('product-logo', $attributes.className)}
        data-r-f7705ee3=""
      >
        {renderProductLogoPart1()}
        <span className="product-logo__wordmark" data-r-f7705ee3="">
          {'Inbox '}
          <b data-r-f7705ee3="">{'Point'}</b>
        </span>
      </span>
    </ModelScopeProvider>
  );
}
