import '@frontend/entities/content/styles/content-revision.react-data-r-b485ff3e.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderContentRevisionPart1 } from './ContentRevision.part1';
import { renderContentRevisionPart3 } from './ContentRevision.part3';
import { renderContentRevisionPart5 } from './ContentRevision.part5';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentRevision.model';

export default function ContentRevision($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { visibility } = $state;
  const content = $state.content.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <div
        {...$attributes}
        className={$class('revision-content', $attributes.className)}
        data-r-b485ff3e=""
      >
        {content.organizationName ? (
          <section data-r-b485ff3e="">
            <h4 data-r-b485ff3e="">{'Название организации'}</h4>
            <p data-r-b485ff3e="">{content.organizationName}</p>
          </section>
        ) : null}
        {renderContentRevisionPart1($state)}
        <section data-r-b485ff3e="">
          <h3 data-r-b485ff3e="">
            {' Цены '}
            <small data-r-b485ff3e="">{visibility('prices')}</small>
          </h3>
          <p data-r-b485ff3e="">{$or(content.prices, () => 'Не заполнено')}</p>
        </section>
        <section data-r-b485ff3e="">
          <h3 data-r-b485ff3e="">
            {' Адрес '}
            <small data-r-b485ff3e="">{visibility('address')}</small>
          </h3>
          <p data-r-b485ff3e="">{$or(content.address, () => 'Не заполнено')}</p>
        </section>
        {renderContentRevisionPart3($state)}
        {renderContentRevisionPart5($state)}
      </div>
    </ModelScopeProvider>
  );
}
