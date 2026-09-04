import * as React from 'react';
import { createModelScope, runInScope, type ModelScope } from './model-state';
import {
  createComponentProps,
  type ModelOptions,
  type ModelRef,
} from './component-props';

type EventName<Name extends string> =
  Name extends `${infer First}-${infer Rest}`
    ? `${First}${Capitalize<EventName<Rest>>}`
    : Name;
export type EventProps<Events> = {
  [
    Name in keyof Events as Name extends string
      ? `on${Capitalize<EventName<Name>>}`
      : never
  ]?: Events[Name] extends unknown[] ? (...args: Events[Name]) => void : never;
};
export interface ComponentAttributes {
  children?: React.ReactNode;
  slots?: Record<string, (props: Record<string, unknown>) => React.ReactNode>;
  attributes?: Record<string, unknown>;
  ref?: React.Ref<Record<string, unknown>>;
  __onModelEvent?: (event: string, ...args: unknown[]) => void;
}
type ModelFactory<Props, State> = (
  props: Props,
  emit: (event: string, ...args: unknown[]) => void,
  model: <Value>(
    name: string,
    options?: ModelOptions<Value>,
  ) => ModelRef<Value>,
  expose: (value: Record<string, unknown>) => void,
) => State;
interface ComponentModel<Props, State> {
  props: Props;
  state: State;
  scope: ModelScope;
  publishExposed(): void;
}
const ParentModelScope = React.createContext<ModelScope | undefined>(undefined);

export function useComponentModel<Props extends object, State>(
  incomingProps: Props,
  defaults: Partial<Props>,
  factory: ModelFactory<Props, State>,
): ComponentModel<Props, State> {
  const parent = React.useContext(ParentModelScope);
  const current = React.useRef(incomingProps);
  current.current = incomingProps;
  const holder = React.useRef<ComponentModel<Props, State> | undefined>(
    undefined,
  );
  if (!holder.current) {
    const scope = createModelScope(parent);
    const { props, emit, model, expose, publishExposed } = createComponentProps(
      current,
      defaults,
    );
    holder.current = {
      scope,
      props,
      publishExposed,
      state: runInScope(scope, () => factory(props, emit, model, expose)),
    };
  }
  const result = holder.current;
  const mountEpoch = React.useRef(0);
  React.useSyncExternalStore(
    result.scope.subscribe,
    result.scope.getVersion,
    result.scope.getVersion,
  );
  React.useLayoutEffect(() => {
    result.scope.checkWatchers();
  });
  React.useLayoutEffect(() => {
    mountEpoch.current++;
    result.scope.mount();
    result.publishExposed();
    return () => {
      const epoch = ++mountEpoch.current;
      queueMicrotask(() => {
        if (mountEpoch.current === epoch) {
          result.scope.dispose();
        }
      });
    };
  }, [result]);
  return result;
}

export function ModelScopeProvider({
  scope,
  children,
}: {
  scope: ModelScope;
  children: React.ReactNode;
}) {
  return (
    <ParentModelScope.Provider value={scope}>
      {children}
    </ParentModelScope.Provider>
  );
}
