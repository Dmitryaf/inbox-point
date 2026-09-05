import type * as React from 'react';
export type ElementProps<
  Tag extends React.ElementType,
  Keys extends PropertyKey = keyof React.ComponentProps<Tag>,
> = Pick<
  React.ComponentProps<Tag>,
  Extract<Keys, keyof React.ComponentProps<Tag>>
> & {
  key?: React.Key | null;
  [attribute: `data-${string}` | `aria-${string}`]: unknown;
};

interface RootAttributes {
  [name: string]: unknown;
  className?: string;
  style?: React.CSSProperties;
}

/** Pass presentation attributes to the single native component root. */
export function inheritedAttributes(props: object): RootAttributes {
  const result: RootAttributes = {};
  for (const key of Object.keys(props)) {
    const value: unknown = Reflect.get(props, key);
    if (value === undefined) {
      continue;
    }
    if (/^(?:aria|data)-/.test(key) || ['id', 'title', 'role'].includes(key)) {
      result[key] = value;
    } else if (key === 'className' && typeof value === 'string') {
      result.className = value;
    } else if (key === 'style' && value && typeof value === 'object') {
      result.style = value;
    }
  }
  return result;
}
