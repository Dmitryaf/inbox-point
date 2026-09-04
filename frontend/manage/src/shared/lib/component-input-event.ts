import type * as React from 'react';
import { publish } from './model-events';

/** Commit a complete controlled-input mutation before React restores its DOM value. */
export function controlledChange<Control extends HTMLElement>(
  update: React.ChangeEventHandler<Control>,
): React.ChangeEventHandler<Control> {
  return (event) => {
    try {
      update(event);
    } finally {
      publish();
    }
  };
}
