import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  setModelValue as $set,
  modelSetter as $setter,
  propertySetter as $propertySetter,
  logicalOr as $or,
} from '@frontend/shared/lib/component-bindings';

import ClassDirectionCreate from './ClassDirectionCreate';
import SectionVisibilityControl from './SectionVisibilityControl';

import type { createComponentModel } from './ClassDirectionList.model';
export function renderClassDirectionListPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const pending = $state.pending.value;
  const draft = $state.draft.value;
  const reviewing = $state.reviewing.value;

  return (
    <>
      {reviewing ? (
        <>
          {$renderList(pending, (item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                void $unref($state.emit)('openTarget', 'group', item.id)
              }
              className="class-list-item"
              data-r-ec1d0881=""
            >
              <strong data-r-ec1d0881="">
                {$or(
                  $or(item.name, () => item.review?.source.split('\n')[0]),
                  () => 'Занятие',
                )}
              </strong>
              <small data-r-ec1d0881="">{'Заполните данные группы'}</small>
            </button>
          ))}
          {!pending.length ? (
            <p data-r-ec1d0881="">{'Старых записей больше нет.'}</p>
          ) : null}
        </>
      ) : (
        <>
          {pending.length ? (
            <button
              type="button"
              onClick={() => void $set($state, 'reviewing', true)}
              className="review-notice"
              data-r-ec1d0881=""
            >
              {' Старые записи расписания: '}
              {pending.length}
            </button>
          ) : null}
          {!draft.directions.length && !pending.length ? (
            <p data-r-ec1d0881="">
              {' Добавьте направление, затем создайте в нём группы. '}
            </p>
          ) : null}
          {$renderList(draft.directions, (item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                void $unref($state.emit)('openTarget', 'direction', item.id)
              }
              className="class-list-item"
              data-r-ec1d0881=""
            >
              <strong data-r-ec1d0881="">
                {$or(item.name, () => 'Новое направление')}
              </strong>
              <small data-r-ec1d0881="">
                {'Групп: '}
                {
                  draft.groups.filter(
                    (entry) => entry.directionId === item.id && !entry.review,
                  ).length
                }
              </small>
            </button>
          ))}
          <ClassDirectionCreate
            onCreated={(id) =>
              $unref($state.emit)('openTarget', 'direction', id)
            }
            modelValue={draft}
            onModelValueChange={$setter($state, 'draft')}
            data-r-ec1d0881=""
          />
          <SectionVisibilityControl
            contentPresent={Boolean(
              $or(draft.directions.length, () => draft.groups.length),
            )}
            section="schedule"
            modelValue={draft.visibleSections}
            onModelValueChange={$propertySetter(
              () => $state.draft.value,
              'visibleSections',
            )}
            data-r-ec1d0881=""
          />
        </>
      )}
    </>
  );
}
