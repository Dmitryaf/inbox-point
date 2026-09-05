import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { isSectionVisible } from '@frontend/entities/content/model/content-draft';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ContentPreview.model';
export function renderContentPreviewPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const visible = $state.visible.value;
  return (
    <>
      {!visible ? (
        <p className="empty">
          {' Заполните разделы — здесь появится будущий ответ. '}
        </p>
      ) : (
        <>
          {$unref(isSectionVisible)($props.content, 'schedule') &&
          $props.content.schedule.trim() ? (
            <div>
              <h3>{'Расписание'}</h3>
              <p className="preserve">{$props.content.schedule}</p>
            </div>
          ) : null}
          {$unref(isSectionVisible)($props.content, 'prices') &&
          $props.content.prices.trim() ? (
            <div>
              <h3>{'Цены'}</h3>
              <p className="preserve">{$props.content.prices}</p>
            </div>
          ) : null}
          {$unref(isSectionVisible)($props.content, 'address') &&
          $props.content.address.trim() ? (
            <div>
              <h3>{'Адрес'}</h3>
              <p className="preserve">{$props.content.address}</p>
            </div>
          ) : null}
          {$unref(isSectionVisible)($props.content, 'faq') &&
          $props.content.faq.length ? (
            <div>
              <h3>{'Частые вопросы'}</h3>
              <dl>
                {$renderList($props.content.faq, (item) => (
                  <>
                    <dt>{$or(item.question, () => 'Вопрос без названия')}</dt>
                    <dd>{$or(item.answer, () => 'Ответ ещё не заполнен')}</dd>
                  </>
                ))}
              </dl>
            </div>
          ) : null}
          {$renderList($props.content.customSections, (section, index) => (
            <div key={index}>
              <h3>{$or(section.label, () => 'Раздел без названия')}</h3>
              <p className="preserve">
                {$or(section.text, () => 'Текст ещё не заполнен')}
              </p>
            </div>
          ))}
        </>
      )}
    </>
  );
}
