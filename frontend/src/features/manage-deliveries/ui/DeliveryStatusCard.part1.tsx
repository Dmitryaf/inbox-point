import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { createComponentModel } from './DeliveryStatusCard.model';
export function renderDeliveryStatusCardPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { retry } = $state;
  const retryingId = $state.retryingId.value;
  const status = $state.status.value;

  return (
    <>
      {status?.failures.length ? (
        <ul className="delivery-failures">
          {$renderList(status.failures, (failure) => (
            <li key={failure.id}>
              <div>
                <strong>{failure.channel}</strong>
                <p>{failure.reason}</p>
                <small>
                  {'Попыток: '}
                  {failure.attempts}
                </small>
              </div>
              {failure.retryAllowed ? (
                <button
                  disabled={retryingId !== ''}
                  type="button"
                  onClick={() => void retry(failure.id)}
                  className="secondary-button"
                >
                  {retryingId === failure.id ? 'Возвращаем…' : 'Повторить'}
                </button>
              ) : (
                <span className="status-pill status-pill--attention">
                  {' Проверить вручную '}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
