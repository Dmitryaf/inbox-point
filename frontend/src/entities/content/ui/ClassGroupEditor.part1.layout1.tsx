import * as React from 'react';
import type { ElementProps } from '@frontend/shared/lib/component-attributes';

export function renderClassGroupEditorPart1Layout1(
  elementProps1: ElementProps<'div', 'key'>,
  elementProps2: ElementProps<'label', 'htmlFor'>,
  content3: React.ReactNode,
  elementProps4: ElementProps<
    'input',
    'id' | 'maxLength' | 'value' | 'onChange'
  >,
  content5: React.ReactNode,
) {
  return (
    <div {...elementProps1} className="class-meeting" data-r-03f428ee="">
      <label {...elementProps2} data-r-03f428ee="">
        {' День и время '}
        {content3}
      </label>
      <div className="class-actions" data-r-03f428ee="">
        <input
          {...elementProps4}

          placeholder="Понедельник, 19:00"

          data-r-03f428ee=""
        />
        {content5}
      </div>
    </div>
  );
}
