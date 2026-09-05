import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref } from '@frontend/shared/lib/model-state';
import { createBackup } from '@frontend/entities/setup/api/setup-api';
import { errorMessage } from '@frontend/shared/lib/error-message';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const pending = ref(false);
  const message = ref('Токены Telegram и VK в копию не входят.');
  async function create(): Promise<void> {
    pending.value = true;
    message.value = 'Создаём и проверяем копию…';
    try {
      const result = await createBackup();
      message.value = `Резервная копия создана: ${result.fileName}.`;
    } catch (cause: unknown) {
      message.value = errorMessage(cause);
    } finally {
      pending.value = false;
    }
  }
  return { pending, message, create };
}
