import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './ChannelStatusCard.model';
export function renderChannelStatusCardPart3(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  if (!$props.channel.configured) {
    return null;
  }
  if (!$props.channel.lastFailure) {
    return null;
  }
  return (
    <>
      {$props.channel.lastFailure.request ? (
        <>
          <div data-r-0b4df92b="">
            <dt data-r-0b4df92b="">{'Метод API'}</dt>
            <dd data-r-0b4df92b="">
              {$props.channel.lastFailure.request.method}
            </dd>
          </div>
          <div data-r-0b4df92b="">
            <dt data-r-0b4df92b="">{'Тип ошибки'}</dt>
            <dd data-r-0b4df92b="">
              {
                {
                  transport: 'Ошибка соединения',
                  http: 'Отказ HTTP',
                  api: 'Отказ API',
                  invalid_response: 'Некорректный ответ',
                }[$props.channel.lastFailure.request.kind]
              }
            </dd>
          </div>
          <div data-r-0b4df92b="">
            <dt data-r-0b4df92b="">{'Длительность запроса'}</dt>
            <dd data-r-0b4df92b="">
              {$props.channel.lastFailure.request.durationMs}
              {' мс'}
            </dd>
          </div>
          {$props.channel.lastFailure.request.transportCodes.length ? (
            <div data-r-0b4df92b="">
              <dt data-r-0b4df92b="">{'Сетевой код'}</dt>
              <dd data-r-0b4df92b="">
                {$props.channel.lastFailure.request.transportCodes.join(', ')}
              </dd>
            </div>
          ) : null}
          {$props.channel.lastFailure.request.httpStatus ? (
            <div data-r-0b4df92b="">
              <dt data-r-0b4df92b="">{'HTTP'}</dt>
              <dd data-r-0b4df92b="">
                {$props.channel.lastFailure.request.httpStatus}
              </dd>
            </div>
          ) : null}
          {$props.channel.lastFailure.request.apiCode !== undefined ? (
            <div data-r-0b4df92b="">
              <dt data-r-0b4df92b="">{'Код API'}</dt>
              <dd data-r-0b4df92b="">
                {$props.channel.lastFailure.request.apiCode}
              </dd>
            </div>
          ) : null}
          <div data-r-0b4df92b="">
            <dt data-r-0b4df92b="">{'ID операции'}</dt>
            <dd data-r-0b4df92b="">
              {$props.channel.lastFailure.request.operationId}
            </dd>
          </div>
        </>
      ) : null}
    </>
  );
}
