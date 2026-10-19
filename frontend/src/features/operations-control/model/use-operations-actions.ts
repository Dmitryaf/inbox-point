import {
  resolveInboundEvent,
  resolveOperationsDelivery,
  resolveOperatorAction,
  retryOperationsDelivery,
} from '@frontend-common/entities/operations/api/operations-api';
import {
  operatorConfirmation,
  operatorNotice,
} from '@frontend-common/entities/operations/lib/operation-confirmation';
import type { OperatorActionResolution } from '@frontend-common/entities/operations/model/types';
import {
  pauseClientIntake,
  pauseOutboundDelivery,
  resumeClientIntake,
  resumeOutboundDelivery,
} from '@frontend-common/entities/service-control/api/service-control-api';
import type { ClientChannel } from '@frontend-common/entities/service-control/model/types';
import { useOperationsCommand } from './use-operations-command';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';
import type { ServiceControlState } from '@frontend-common/entities/service-control/model/types';

export function useOperationsActions(refresh: () => Promise<unknown>) {
  const client = useQueryClient();
  const { epoch } = useAdminSession();
  const acceptControl = (state: ServiceControlState) =>
    client.setQueryData(['session', epoch, 'operations', 'control'], state);
  const delivery = useOperationsCommand(refresh);
  const operator = useOperationsCommand(refresh);
  const inbound = useOperationsCommand(refresh);
  const intake = useOperationsCommand(refresh);
  const outbound = useOperationsCommand(refresh);
  return {
    delivery,
    operator,
    inbound,
    intake,
    outbound,
    retryDelivery: (id: string) =>
      void delivery.run(
        id,
        () => retryOperationsDelivery(id),
        'Повторная отправка началась.',
        'Отправить этот ответ ещё раз?',
      ),
    resolveDelivery: (id: string, resolution: 'not_received' | 'received') =>
      void delivery.run(
        id,
        () => resolveOperationsDelivery(id, resolution),
        resolution === 'received'
          ? 'Получение сообщения подтверждено.'
          : 'Повторная отправка началась.',
        resolution === 'received'
          ? 'Подтвердить, что клиент получил сообщение? Повторной отправки не будет.'
          : 'Подтвердить, что сообщение не получено, и отправить его повторно?',
      ),
    resolveOperator: (id: string, resolution: OperatorActionResolution) =>
      void operator.run(
        id,
        () => resolveOperatorAction(id, resolution),
        operatorNotice(resolution),
        operatorConfirmation(resolution),
      ),
    resolveInbound: (
      id: string,
      source: string,
      resolution: 'retry' | 'skip',
    ) =>
      void inbound.run(
        id,
        () => resolveInboundEvent(id, source, resolution),
        resolution === 'retry'
          ? 'Повторная обработка началась.'
          : 'Повторной обработки не будет.',
        resolution === 'skip'
          ? 'Отказаться от обработки? Повторной попытки для этих данных не будет.'
          : undefined,
      ),
    changeIntake: (channel: ClientChannel, mode: 'active' | 'paused') =>
      void intake.run(
        channel,
        () =>
          mode === 'paused'
            ? pauseClientIntake(channel)
            : resumeClientIntake(channel),
        `Новые обращения из ${channel === 'telegram' ? 'Telegram' : 'VK'} ${mode === 'paused' ? 'приостановлены.' : 'снова принимаются.'}`,
        mode !== 'paused'
          ? undefined
          : channel === 'telegram'
            ? 'Приостановить новые обращения в Telegram? Бот сообщит о паузе и предложит связаться по контакту из описания.'
            : 'Приостановить новые обращения из VK? Новые сообщения останутся в сообществе, но не появятся у администратора.',
        acceptControl,
      ),
    changeOutbound: (mode: 'pause' | 'resume') =>
      void outbound.run(
        mode,
        () =>
          mode === 'pause' ? pauseOutboundDelivery() : resumeOutboundDelivery(),
        mode === 'pause'
          ? 'Ответы клиентам приостановлены. Сохранённые ответы не потеряны.'
          : 'Ответы клиентам возобновлены.',
        mode === 'pause'
          ? 'Приостановить ответы клиентам? Новые и ещё не отправленные ответы сохранятся до возобновления.'
          : undefined,
      ),
  };
}
