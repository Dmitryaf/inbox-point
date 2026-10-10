import * as React from 'react';
import type { ElementProps } from '@frontend/shared/lib/component-attributes';

import ClassGroupPreview from './ClassGroupPreview';

export function renderClassGroupEditorPart1Layout2(
  elementProps1: ElementProps<'details'>,
  content2: React.ReactNode,
  content3: React.ReactNode,
  elementProps4: ElementProps<'label', 'htmlFor'>,
  elementProps5: ElementProps<
    'input',
    'id' | 'maxLength' | 'value' | 'onChange'
  >,
  elementProps6: ElementProps<'label', 'htmlFor'>,
  elementProps7: ElementProps<'select', 'id' | 'value' | 'onChange'>,
  content8: React.ReactNode,
  content9: React.ReactNode,
  elementProps10: ElementProps<'button', 'disabled' | 'onClick'>,
  elementProps11: ElementProps<'label', 'htmlFor'>,
  elementProps12: ElementProps<
    'textarea',
    'id' | 'rows' | 'maxLength' | 'value' | 'onChange'
  >,
  elementProps13: ElementProps<'input', 'checked' | 'onChange'>,
  elementProps14: ElementProps<'label', 'htmlFor'>,
  elementProps15: ElementProps<
    'textarea',
    'id' | 'rows' | 'maxLength' | 'value' | 'onChange'
  >,
  elementProps16: ElementProps<typeof ClassGroupPreview, 'content' | 'groupId'>,
  elementProps17: ElementProps<'button', 'onClick'>,
) {
  return (
    <details {...elementProps1}>
      <summary data-r-03f428ee="">
        <strong data-r-03f428ee="">{content2}</strong>
        {' · '}
        {content3}
      </summary>
      <label {...elementProps4} data-r-03f428ee="">
        {' Название группы '}
      </label>
      <input
        {...elementProps5}

        placeholder="Например, Начинающие"

        data-r-03f428ee=""
      />
      <label {...elementProps6} data-r-03f428ee="">
        {' Направление '}
      </label>
      <select
        {...elementProps7}

        data-r-03f428ee=""
      >
        {content8}
      </select>
      {content9}
      <button
        type="button"
        {...elementProps10}

        data-r-03f428ee=""
      >
        {' Добавить день и время '}
      </button>
      <label {...elementProps11} data-r-03f428ee="">
        {' Короткое описание группы '}
      </label>
      <textarea
        {...elementProps12}

        placeholder="Кому подойдут занятия и что нужно знать перед первым визитом"

        data-r-03f428ee=""
      />
      <label className="class-check" data-r-03f428ee="">
        <input
          type="checkbox"
          {...elementProps13}

          data-r-03f428ee=""
        />
        {' Открыть набор в группу '}
      </label>
      <p data-r-03f428ee="">
        {
          ' При открытом наборе клиент увидит кнопку «Записаться на занятие». После его ответа вы получите заявку и сможете подтвердить место. '
        }
      </p>
      <label {...elementProps14} data-r-03f428ee="">
        {' Что спросить после нажатия «Записаться» '}
      </label>
      <textarea
        {...elementProps15}

        data-r-03f428ee=""
      />
      <p data-r-03f428ee="">
        {
          ' Направление и группа уже выбраны. Не просите клиента указывать их снова. '
        }
      </p>
      <ClassGroupPreview
        {...elementProps16}

        data-r-03f428ee=""
      />
      <button
        type="button"
        {...elementProps17}
        className="danger"
        data-r-03f428ee=""
      >
        {'Удалить группу'}
      </button>
    </details>
  );
}
