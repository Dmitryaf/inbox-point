import * as React from 'react';
import type { ElementProps } from '@frontend/shared/lib/component-attributes';

import ClassGroupPreview from './ClassGroupPreview';
import ClassGroupReview from './ClassGroupReview';
import ClassGroupSettings from './ClassGroupSettings';
import ClassKeywordsEditor from './ClassKeywordsEditor';

export function renderClassGroupEditorPart1Layout1(
  elementProps1: ElementProps<'div'>,
  elementProps2: ElementProps<
    typeof ClassGroupReview,
    'modelValue' | 'directions' | 'groups'
  >,
  elementProps3: ElementProps<'label', 'htmlFor'>,
  elementProps4: ElementProps<
    'input',
    'id' | 'maxLength' | 'value' | 'onChange'
  >,
  content5: React.ReactNode,
  elementProps6: ElementProps<'button', 'disabled' | 'onClick'>,
  elementProps7: ElementProps<'input', 'disabled' | 'checked' | 'onChange'>,
  elementProps8: ElementProps<
    typeof ClassKeywordsEditor,
    'targetId' | 'onOpenTarget' | 'modelValue' | 'onModelValueChange'
  >,
  elementProps9: ElementProps<typeof ClassGroupPreview, 'content' | 'groupId'>,
  elementProps10: ElementProps<
    typeof ClassGroupSettings,
    'modelValue' | 'directions' | 'onRemove'
  >,
) {
  return (
    <div {...elementProps1}>
      <ClassGroupReview
        {...elementProps2}

        data-r-03f428ee=""
      />
      <label {...elementProps3} data-r-03f428ee="">
        {'Название группы'}
      </label>
      <input
        {...elementProps4}

        placeholder="Например, Начинающие"

        data-r-03f428ee=""
      />
      {content5}
      <button
        type="button"
        {...elementProps6}

        data-r-03f428ee=""
      >
        {' Добавить день и время '}
      </button>
      <label className="class-check" data-r-03f428ee="">
        <input
          type="checkbox"
          {...elementProps7}

          data-r-03f428ee=""
        />
        {' Открыть набор в группу '}
      </label>
      <p data-r-03f428ee="">
        {'После ответа клиента вы получите заявку и сможете подтвердить место.'}
      </p>
      <ClassKeywordsEditor
        targetType="group"
        {...elementProps8}

        data-r-03f428ee=""
      />
      <ClassGroupPreview
        {...elementProps9}

        data-r-03f428ee=""
      />
      <ClassGroupSettings
        {...elementProps10}

        data-r-03f428ee=""
      />
    </div>
  );
}
