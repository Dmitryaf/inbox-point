import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentPreview.model';

export default function ContentPreview($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const responses = $state.responses.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="preview-title"
        className={$class('card preview', $attributes.className)}
      >
        <p className="step">{'Предпросмотр'}</p>
        <h2 id="preview-title">{'Что увидит клиент'}</h2>
        {responses.length === 0 ? (
          <p className="empty">
            {' Заполните разделы — здесь появится будущий ответ. '}
          </p>
        ) : (
          $renderList(responses, (response) => (
            <article key={response.label} className="preview-response">
              <p className="preview-response-label">
                {'Кнопка «'}
                {response.label}
                {'»'}
              </p>
              <p className="preserve">{response.text}</p>
            </article>
          ))
        )}
      </section>
    </ModelScopeProvider>
  );
}
