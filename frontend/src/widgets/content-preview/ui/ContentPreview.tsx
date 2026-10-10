import '@frontend/widgets/content-preview/styles/content-preview.react-data-r-e038eaba.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderContentPreviewPart1 } from './ContentPreview.part1';
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
  const empty = $unref($state.empty);
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="preview-title"
        className={$class('card preview', $attributes.className)}
        data-r-e038eaba=""
      >
        <h2 id="preview-title" data-r-e038eaba="">
          {'Предпросмотр ответов'}
        </h2>
        <p className="preview-intro" data-r-e038eaba="">
          {
            ' Нажимайте кнопки, чтобы пройти путь клиента. Здесь показаны текст и действия; оформление кнопок зависит от VK или Telegram. Сообщения не отправляются. '
          }
        </p>
        <button
          type="button"
          onClick={() => void $set($state, 'action', 'main')}
          className="secondary-button"
          data-r-e038eaba=""
        >
          {' Начать с меню '}
        </button>
        {empty ? (
          <p className="empty" data-r-e038eaba="">
            {' Заполните разделы — здесь появится будущий ответ. '}
          </p>
        ) : null}
        {renderContentPreviewPart1($state)}
      </section>
    </ModelScopeProvider>
  );
}
