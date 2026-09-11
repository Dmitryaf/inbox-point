import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ChannelIntakeControls.model';
export function renderChannelIntakeControlsPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { channelName, pauseExplanation, $emit, canPause } = $state;

  return (
    <>
      {$renderList(['telegram', 'vk'] as const, (channel) => (
        <article key={channel} data-r-0bf4defe="">
          <div data-r-0bf4defe="">
            <div className="intake-channel-heading" data-r-0bf4defe="">
              <strong data-r-0bf4defe="">{channelName(channel)}</strong>
              <span
                className={$class('intake-status', {
                  'intake-status--disconnected':
                    !$props.channels[channel].configured,
                  'intake-status--paused':
                    $props.channels[channel].configured &&
                    $props.state.channels[channel].mode === 'paused',
                })}
                data-r-0bf4defe=""
              >
                {!$props.channels[channel].configured
                  ? 'Не подключён'
                  : $props.state.channels[channel].mode === 'paused'
                    ? 'На паузе'
                    : 'Приём включён'}
              </span>
            </div>
            <p data-r-0bf4defe="">{pauseExplanation(channel)}</p>
          </div>
          {canPause(channel) ? (
            <button
              type="button"
              disabled={Boolean($props.pendingChannel)}
              onClick={() => void $emit('change', channel, 'paused')}
              className="danger"
              data-r-0bf4defe=""
            >
              {$props.pendingChannel === channel
                ? 'Приостанавливаем…'
                : 'Приостановить'}
            </button>
          ) : $props.channels[channel].configured ? (
            <button
              type="button"
              disabled={Boolean($props.pendingChannel)}
              onClick={() => void $emit('change', channel, 'active')}
              data-r-0bf4defe=""
            >
              {$props.pendingChannel === channel
                ? 'Возобновляем…'
                : 'Возобновить'}
            </button>
          ) : null}
        </article>
      ))}
    </>
  );
}
