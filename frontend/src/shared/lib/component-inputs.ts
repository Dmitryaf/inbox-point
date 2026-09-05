import type * as React from 'react';
import { controlledChange } from './component-input-event';
import {
  requiredValue,
  setModelValue,
  setProperty,
  type ModelValue,
} from './component-bindings';
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function textModel<State extends object, Key extends keyof State>(
  state: State,
  key: Key,
): React.ChangeEventHandler<Control> {
  return controlledChange<Control>((event) => {
    setModelValue(
      state,
      key,
      event.currentTarget.value as ModelValue<State[Key]>,
    );
  });
}
export function textProperty<State extends object, Key extends keyof State>(
  read: () => State | undefined | null,
  key: Key,
): React.ChangeEventHandler<Control> {
  return controlledChange<Control>((event) => {
    setProperty(
      requiredValue(read()),
      key,
      event.currentTarget.value as State[Key],
    );
  });
}
export function checkboxModel<State extends object, Key extends keyof State>(
  state: State,
  key: Key,
): React.ChangeEventHandler<HTMLInputElement> {
  return controlledChange<HTMLInputElement>((event) => {
    setModelValue(
      state,
      key,
      event.currentTarget.checked as ModelValue<State[Key]>,
    );
  });
}
export function checkboxProperty<State extends object, Key extends keyof State>(
  read: () => State | undefined | null,
  key: Key,
): React.ChangeEventHandler<HTMLInputElement> {
  return controlledChange<HTMLInputElement>((event) => {
    setProperty(
      requiredValue(read()),
      key,
      event.currentTarget.checked as State[Key],
    );
  });
}
export function radioModel<State extends object, Key extends keyof State>(
  state: State,
  key: Key,
  option: ModelValue<State[Key]>,
): React.ChangeEventHandler<HTMLInputElement> {
  return controlledChange<HTMLInputElement>((event) => {
    if (event.currentTarget.checked) {
      setModelValue(state, key, option);
    }
  });
}
export function radioProperty<State extends object, Key extends keyof State>(
  read: () => State | undefined | null,
  key: Key,
  option: State[Key],
): React.ChangeEventHandler<HTMLInputElement> {
  return controlledChange<HTMLInputElement>((event) => {
    if (event.currentTarget.checked) {
      setProperty(requiredValue(read()), key, option);
    }
  });
}
