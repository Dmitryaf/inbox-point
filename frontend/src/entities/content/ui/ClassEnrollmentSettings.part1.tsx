import { unref as $unref } from '@frontend/shared/lib/model-state';

import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';

import { defaultApplicationQuestion } from '@core/application/class-content';

import type { createComponentModel } from './ClassEnrollmentSettings.model';
export function renderClassEnrollmentSettingsPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const group = $state.group.value;

  return (
    <>
      <div
        style={Object.assign(
          {},
          { display: group.enrollmentOpen ? undefined : 'none' },
        )}
        data-r-07c17d8d=""
      >
        <label htmlFor={'group-question-' + group.id} data-r-07c17d8d="">
          {'Вопрос клиенту для записи'}
        </label>
        <textarea
          id={'group-question-' + group.id}
          rows={2}
          maxLength={1000}
          placeholder={$unref(defaultApplicationQuestion)}
          value={group.applicationQuestion ?? ''}
          onChange={$textProperty(
            () => $state.group.value,
            'applicationQuestion',
          )}
          data-r-07c17d8d=""
        />
        <p className="class-hint" data-r-07c17d8d="">
          {
            ' После нажатия кнопки бот задаст этот вопрос. Ответ клиента придёт администратору вместе с названием группы. Вы сможете подтвердить место. '
          }
        </p>
      </div>
    </>
  );
}
