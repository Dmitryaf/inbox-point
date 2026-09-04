import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';
import { invokeHandler as $invoke } from '@manage/shared/lib/component-events';

import { setModelValue as $set } from '@manage/shared/lib/component-bindings';
import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './LoginForm.model';
import { controlledChange as $controlledChange } from '@manage/shared/lib/component-input-event';

export default function LoginForm($incomingProps: ComponentProps) {
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
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <form
        {...$attributes}
        onSubmit={($event) => {
          $event.preventDefault();
          $invoke(submit, $event);
        }}
        className={$class('login card', $attributes.className)}
      >
        <h2>{'Вход'}</h2>
        <p>{'Введите пароль, который выдал владелец сервиса.'}</p>
        <label htmlFor="password">{'Пароль'}</label>
        <input
          id="password"
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
