import * as React from 'react';
import type { ElementProps } from '@frontend/shared/lib/component-attributes';

import SectionVisibilityControl from './SectionVisibilityControl';

import ClassScheduleEditor from './ClassScheduleEditor';
import LegacyScheduleAssignment from './LegacyScheduleAssignment';

export function renderScheduleEditorLayout1(
  elementProps1: ElementProps<'details'>,
  content2: React.ReactNode,
  content3: React.ReactNode,
  content4: React.ReactNode,
  elementProps5: ElementProps<
    typeof ClassScheduleEditor,
    'modelValue' | 'onModelValueChange'
  >,
  content6: React.ReactNode,
  elementProps7: ElementProps<
    typeof LegacyScheduleAssignment,
    'modelValue' | 'onModelValueChange'
  >,
  content8: React.ReactNode,
  content9: React.ReactNode,
  content10: React.ReactNode,
  elementProps11: ElementProps<'button', 'disabled' | 'onClick'>,
  elementProps12: ElementProps<'p', 'className'>,
  content13: React.ReactNode,
  elementProps14: ElementProps<
    typeof SectionVisibilityControl,
    'contentPresent' | 'modelValue' | 'onModelValueChange'
  >,
) {
  return (
    <details {...elementProps1}>
      {content2}
      {content3}
      {content4}
      <ClassScheduleEditor
        {...elementProps5}

        data-r-e7737cb0=""
      />
      {content6}
      <LegacyScheduleAssignment
        {...elementProps7}

        data-r-e7737cb0=""
      />
      {content8}
      <div className="section-heading" data-r-e7737cb0="">
        <p data-r-e7737cb0="">
          {'Старые карточки показываются в разделе «Другие занятия».'}
        </p>
        <span data-r-e7737cb0="">
          {content9}
          {' / '}
          {content10}
        </span>
      </div>
      <button
        id="add-schedule"
        {...elementProps11}
        type="button"

        data-r-e7737cb0=""
      >
        {' Добавить старую карточку '}
      </button>
      <p aria-live="polite" {...elementProps12} data-r-e7737cb0="">
        {' Итоговый ответ: '}
        {content13}
        {' / 4000 '}
      </p>
      <SectionVisibilityControl
        {...elementProps14}
        section="schedule"

        data-r-e7737cb0=""
      />
    </details>
  );
}
