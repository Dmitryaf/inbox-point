import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperatorRequestList.model';
export function renderOperatorRequestListPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit, channelName } = $state;

  return (
    <>
      {$renderList($props.requests, (request) => (
        <button
          key={request.id}
          type="button"
          aria-pressed={request.id === $props.selectedRequestId}
          onClick={() => void $emit('select', request.id)}
          className={$class('operator-request-button', {
            'operator-request-button--selected':
              request.id === $props.selectedRequestId,
          })}
          data-r-f52dee34=""
        >
          <strong data-r-f52dee34="">
            {$or(request.displayName, () => 'Без имени')}
          </strong>
          <span className="channel-badge" data-r-f52dee34="">
            {channelName(request.channel)}
          </span>
          <time
            dateTime={$or(request.latestMessageAt, () => request.createdAt)}
            data-r-f52dee34=""
          >
            {$unref(formatShortDateTime)(
              $or(request.latestMessageAt, () => request.createdAt),
            )}
          </time>
        </button>
      ))}
    </>
  );
}
