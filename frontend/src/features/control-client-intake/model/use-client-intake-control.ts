import { ref } from 'vue';

import {
  loadServiceControl,
  pauseClientIntake,
  resumeClientIntake,
} from '@frontend/entities/service-control/api/service-control-api';
import type {
  ClientChannel,
  ServiceControlState,
} from '@frontend/entities/service-control/model/types';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

interface ClientIntakeControlOptions {
  onChanged: () => void;
  onUnauthorized: () => void;
}

export function useClientIntakeControl(options: ClientIntakeControlOptions) {
  const state = ref<ServiceControlState>();
  const loading = ref(true);
  const pendingChannel = ref<ClientChannel>();
  const actionError = ref('');
  const notice = ref('');

  async function load(): Promise<string> {
    loading.value = true;
    try {
      state.value = await loadServiceControl();
      return '';
    } catch (cause: unknown) {
      return requestErrorMessage(cause, options.onUnauthorized);
    } finally {
      loading.value = false;
    }
  }

  async function changeMode(
    channel: ClientChannel,
    mode: 'active' | 'paused',
  ): Promise<void> {
    if (mode === 'paused' && !confirmPause(channel)) {
      return;
    }
    pendingChannel.value = channel;
    actionError.value = '';
    notice.value = '';
    try {
      if (mode === 'paused') {
        state.value = await pauseClientIntake(channel);
      } else {
        state.value = await resumeClientIntake(channel);
      }
      notice.value = modeNotice(channel, mode);
      options.onChanged();
    } catch (cause: unknown) {
      actionError.value = requestErrorMessage(cause, options.onUnauthorized);
    } finally {
      pendingChannel.value = undefined;
    }
  }

  return {
    actionError,
    changeMode,
    load,
    loading,
    notice,
    pendingChannel,
    state,
  };
}

function confirmPause(channel: ClientChannel): boolean {
  if (channel === 'telegram') {
    return window.confirm(
      'Приостановить новые обращения в Telegram? Бот сообщит о паузе и предложит связаться по контакту из описания.',
    );
  }
  return window.confirm(
    'Приостановить новые обращения из VK? Новые сообщения останутся в сообществе, но не появятся у оператора.',
  );
}

function modeNotice(channel: ClientChannel, mode: 'active' | 'paused') {
  const name = channel === 'telegram' ? 'Telegram' : 'VK';
  if (mode === 'paused') {
    return `Новые обращения из ${name} приостановлены.`;
  }
  return `Новые обращения из ${name} снова принимаются.`;
}
