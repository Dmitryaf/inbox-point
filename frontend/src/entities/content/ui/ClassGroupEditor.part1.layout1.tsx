import * as React from 'react';
import type { ElementProps } from '@frontend/shared/lib/component-attributes';

import ClassEnrollmentSettings from './ClassEnrollmentSettings';
import ClassGroupReview from './ClassGroupReview';
import ClassGroupSettings from './ClassGroupSettings';
import ClassKeywordsEditor from './ClassKeywordsEditor';

export function renderClassGroupEditorPart1Layout1(
  elementProps1: ElementProps<'div'>,
  elementProps2: ElementProps<
    typeof ClassGroupReview,
    'modelValue' | 'groups' | 'onOpenGroup'
  >,
  elementProps3: ElementProps<'label', 'htmlFor'>,
  elementProps4: ElementProps<'select', 'id' | 'value' | 'onChange'>,
  content5: React.ReactNode,
  content6: React.ReactNode,
  elementProps7: ElementProps<'label', 'htmlFor'>,
  elementProps8: ElementProps<
    'input',
    'id' | 'maxLength' | 'value' | 'onChange'
  >,
  elementProps9: ElementProps<'label', 'htmlFor'>,
  elementProps10: ElementProps<
    'textarea',
    'id' | 'rows' | 'value' | 'onChange'
  >,
  elementProps11: ElementProps<
    typeof ClassEnrollmentSettings,
    'directions' | 'groups' | 'modelValue' | 'onModelValueChange'
  >,
  elementProps12: ElementProps<
    typeof ClassKeywordsEditor,
    'targetId' | 'onOpenTarget' | 'modelValue' | 'onModelValueChange'
  >,
  elementProps13: ElementProps<'button', 'onClick'>,
  elementProps14: ElementProps<'button', 'onClick'>,
  elementProps15: ElementProps<typeof ClassGroupSettings, 'modelValue'>,
) {
  return (
    <div {...elementProps1}>
      <ClassGroupReview
        {...elementProps2}

        data-r-03f428ee=""
      />
      <label {...elementProps3} data-r-03f428ee="">
        {'Направление'}
      </label>
      <select
        {...elementProps4}

        data-r-03f428ee=""
      >
        <option value="" data-r-03f428ee="">
          {'Выберите направление'}
        </option>
        {content5}
      </select>
      {content6}
      <label {...elementProps7} data-r-03f428ee="">
        {'Название группы'}
      </label>
      <input
        {...elementProps8}

        placeholder="Например, Начинающие"

        data-r-03f428ee=""
      />
      <label {...elementProps9} data-r-03f428ee="">
        {'Дни и время занятий'}
      </label>
      <textarea
        {...elementProps10}

        placeholder="Пн/Ср — 20:00 или Пн 20:00, Ср 19:00"

        data-r-03f428ee=""
      />
      <ClassEnrollmentSettings
        {...elementProps11}

        data-r-03f428ee=""
      />
      <ClassKeywordsEditor
        targetType="group"
        {...elementProps12}

        data-r-03f428ee=""
      />
      <div className="class-actions" data-r-03f428ee="">
        <button
          type="button"
          {...elementProps13}
          className="secondary-button"
          data-r-03f428ee=""
        >
          {' Посмотреть как клиент '}
        </button>
        <button
          type="button"
          {...elementProps14}
          className="danger"
          data-r-03f428ee=""
        >
          {' Удалить группу '}
        </button>
      </div>
      <ClassGroupSettings {...elementProps15} data-r-03f428ee="" />
    </div>
  );
}
