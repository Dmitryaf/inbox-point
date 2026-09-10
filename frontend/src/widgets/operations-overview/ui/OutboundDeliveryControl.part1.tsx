import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OutboundDeliveryControl.model';
export function renderOutboundDeliveryControlPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      {$props.outbound.mode === 'active' ? (
        <button
          type="button"
          disabled={Boolean($props.pending)}
          onClick={() => void $emit('change', 'pause')}
          className="danger"
          data-r-858ac0fd=""
        >
          {$props.pending === 'pause'
            ? 'Останавливаем…'
            : 'Остановить доставку'}
        </button>
      ) : (
        <button
          type="button"
          disabled={Boolean($props.pending)}
          onClick={() => void $emit('change', 'resume')}
          data-r-858ac0fd=""
        >
          {$props.pending === 'resume'
            ? 'Возобновляем…'
            : 'Возобновить доставку'}
        </button>
      )}
    </>
  );
}
