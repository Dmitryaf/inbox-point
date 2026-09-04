import {
  useComponentModel,
  ModelScopeProvider,
} from '@ops/shared/lib/component-model';
import { classNames as $class } from '@ops/shared/lib/component-view';
import { invokeHandler as $invoke } from '@ops/shared/lib/component-events';

import { setModelValue as $set } from '@ops/shared/lib/component-bindings';
import { inheritedAttributes } from '@ops/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperationsLoginForm.model';
import { controlledChange as $controlledChange } from '@ops/shared/lib/component-input-event';

export default function OperationsLoginForm($incomingProps: ComponentProps) {
  const $attributes = inheritedAttributes($incomingProps);
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { submit } = $state;

  const password = $state.password.value;
  return (
    <ModelScopeProvider scope={$scope}>
      <form
        {...$attributes}
        onSubmit={($event) => {
          $event.preventDefault();
          $invoke(submit, $event);
        }}
        className={$class('login-card card', $attributes.className)}
      >
        <h2>{'Вход владельца'}</h2>
        <p>{'Введите отдельный пароль мониторинга сервиса.'}</p>
        <label htmlFor="ops-password">{'Пароль'}</label>
        <input
          id="ops-password"
          autoComplete="current-password"
          required
          type="password"
          value={password ?? ''}
          onChange={$controlledChange<HTMLInputElement>(($event) => {
            $set($state, 'password', $event.currentTarget.value);
          })}
        />
        <button disabled={$props.pending} type="submit">
          {$props.pending ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </ModelScopeProvider>
  );
}
