import { computed, onMounted, ref } from 'vue';

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
  const error = ref('');
  const notice = ref('');
  const pausedChannels = computed(() => {
    if (!state.value) {
      return 0;
    }
    return Object.values(state.value.channels).filter(
      (channel) => channel.mode === 'paused',
    ).length;
  });
  const summaryStatus = computed(() => {
    if (loading.value) {
      return { label: 'Проверяем…', tone: 'neutral' };
    }
    if (!state.value || error.value) {
      return { label: 'Не удалось проверить', tone: 'error' };
    }
    if (pausedChannels.value > 0) {
      return { label: `На паузе: ${pausedChannels.value}`, tone: 'paused' };
    }
    return { label: 'Приём включён', tone: 'active' };
  });

  onMounted(() => void load());

  async function load(): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      state.value = await loadServiceControl();
    } catch (cause: unknown) {
      reportFailure(cause);
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
    error.value = '';
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
      reportFailure(cause);
    } finally {
      pendingChannel.value = undefined;
    }
  }

  function reportFailure(cause: unknown): void {
    error.value = requestErrorMessage(cause, options.onUnauthorized);
  }

  return {
    changeMode,
    error,
    load,
    loading,
    notice,
    pendingChannel,
    state,
    summaryStatus,
  };
}

function confirmPause(channel: ClientChannel): boolean {
  if (channel === 'telegram') {
    return window.confirm(
      'Приостановить новые обращения в Telegram? В боте появится сообщение о временной паузе.',
    );
  }
  return window.confirm(
    'Приостановить новые обращения из VK? В сообществе появится сообщение о временной паузе.',
  );
}

function modeNotice(channel: ClientChannel, mode: 'active' | 'paused') {
  const name = channel === 'telegram' ? 'Telegram' : 'VK';
  if (mode === 'paused') {
    return `Новые обращения из ${name} приостановлены.`;
  }
  return `Новые обращения из ${name} снова принимаются.`;
}
