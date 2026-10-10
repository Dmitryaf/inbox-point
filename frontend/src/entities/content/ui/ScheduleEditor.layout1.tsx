import * as React from 'react';
import type { ElementProps } from '@frontend/shared/lib/component-attributes';

import SectionVisibilityControl from './SectionVisibilityControl';

import ClassScheduleEditor from './ClassScheduleEditor';
import LegacyScheduleAssignment from './LegacyScheduleAssignment';

export function renderScheduleEditorLayout1(
  elementProps1: ElementProps<'details'>,
  content2: React.ReactNode,
  elementProps3: ElementProps<
    typeof ClassScheduleEditor,
    'modelValue' | 'onModelValueChange'
  >,
  elementProps4: ElementProps<
    typeof LegacyScheduleAssignment,
    'modelValue' | 'onModelValueChange'
  >,
  content5: React.ReactNode,
  content6: React.ReactNode,
  content7: React.ReactNode,
  content8: React.ReactNode,
  content9: React.ReactNode,
  elementProps10: ElementProps<'button', 'disabled' | 'onClick'>,
  elementProps11: ElementProps<'p', 'className'>,
  content12: React.ReactNode,
  elementProps13: ElementProps<
    typeof SectionVisibilityControl,
    'contentPresent' | 'modelValue' | 'onModelValueChange'
  >,
) {
  return (
    <details {...elementProps1}>
      {content2}
      <ClassScheduleEditor
        {...elementProps3}

        data-r-e7737cb0=""
      />
      <h3 data-r-e7737cb0="">{'Старые записи расписания'}</h3>
      <p data-r-e7737cb0="">
        {
          ' Эти занятия сохранены без изменений. Их можно перенести в группы вручную. '
        }
      </p>
      <LegacyScheduleAssignment
        {...elementProps4}

        data-r-e7737cb0=""
      />
      {content5}
      {content6}
      {content7}
      <div className="section-heading" data-r-e7737cb0="">
        <p data-r-e7737cb0="">
          {'Старые карточки показываются в разделе «Другие занятия».'}
        </p>
        <span data-r-e7737cb0="">
          {content8}
          {' / '}
          {content9}
        </span>
      </div>
      <button
        id="add-schedule"
        {...elementProps10}
        type="button"

        data-r-e7737cb0=""
      >
        {' Добавить старую карточку '}
      </button>
      <p aria-live="polite" {...elementProps11} data-r-e7737cb0="">
        {' Итоговый ответ: '}
        {content12}
        {' / 4000 '}
      </p>
      <SectionVisibilityControl
        {...elementProps13}
        section="schedule"

        data-r-e7737cb0=""
      />
    </details>
  );
}
