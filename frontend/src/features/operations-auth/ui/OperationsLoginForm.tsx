import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';
import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperationsLoginForm.model';

export default function OperationsLoginForm($incomingProps: ComponentProps) {
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
        onSubmit={$nativeHandler(submit, { prevent: true })}
        className={$class('auth-card card', $attributes.className)}
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
          onChange={$textModel($state, 'password')}
        />
        <button disabled={$props.pending} type="submit">
          {$props.pending ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </ModelScopeProvider>
  );
}
