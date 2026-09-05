import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import AppIcon from '@frontend/shared/ui/AppIcon';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentSummary.model';

export default function ContentSummary($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const totalCount = $state.totalCount.value;
  const standardCount = $state.standardCount.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="content-summary-title"
        className={$class('content-summary', $attributes.className)}
      >
        <div className="summary-heading">
          <span className="summary-icon">
            <AppIcon name="channel" />
          </span>
          <div>
            <p>{'Меню клиентов'}</p>
            <h3 id="content-summary-title">
              {totalCount ? 'Готово к показу' : 'Пока не заполнено'}
            </h3>
          </div>
        </div>
        <dl className="content-facts">
          <div>
            <dt>{'Основные кнопки'}</dt>
            <dd>
              {standardCount}
              {' из 4'}
            </dd>
          </div>
          <div>
            <dt>{'Частые вопросы'}</dt>
            <dd>{$props.content.faq.length}</dd>
          </div>
          <div>
            <dt>{'Свои разделы'}</dt>
            <dd>{$props.content.customSections.length}</dd>
          </div>
        </dl>
        <p className="channel-note">
          <AppIcon name="check" />
          {' После сохранения изменения увидят клиенты Telegram и VK. '}
        </p>
      </section>
    </ModelScopeProvider>
  );
}
