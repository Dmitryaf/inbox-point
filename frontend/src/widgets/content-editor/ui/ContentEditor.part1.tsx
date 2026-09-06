import {
  modelSetter as $setter,
  propertySetter as $propertySetter,
} from '@frontend/shared/lib/component-bindings';

import CoreSectionsFields from '@frontend/entities/content/ui/CoreSectionsFields';
import CustomSectionsEditor from '@frontend/entities/content/ui/CustomSectionsEditor';
import FaqEditor from '@frontend/entities/content/ui/FaqEditor';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ContentEditor.model';
export function renderContentEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const draft = $state.draft.value;

  return (
    <>
      {$props.activeSection === 'core' ? (
        <CoreSectionsFields
          modelValue={draft}
          onModelValueChange={$setter($state, 'draft')}
        />
      ) : $props.activeSection === 'faq' ? (
        <FaqEditor
          modelValue={draft}
          onModelValueChange={$setter($state, 'draft')}
        />
      ) : (
        <CustomSectionsEditor
          modelValue={draft.customSections}
          onModelValueChange={$propertySetter(
            () => $state.draft.value,
            'customSections',
          )}
        />
      )}
    </>
  );
}
