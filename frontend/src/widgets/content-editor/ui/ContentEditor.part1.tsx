import {
  setModelValue as $set,
  requiredValue as $required,
  setProperty as $setProperty,
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
          onModelValueChange={($value) => {
            $set($state, 'draft', $value);
          }}
        />
      ) : $props.activeSection === 'faq' ? (
        <FaqEditor
          modelValue={draft.faq}
          onModelValueChange={($value) => {
            $setProperty($required($state.draft.value), 'faq', $value);
          }}
        />
      ) : (
        <CustomSectionsEditor
          modelValue={draft.customSections}
          onModelValueChange={($value) => {
            $setProperty(
              $required($state.draft.value),
              'customSections',
              $value,
            );
          }}
        />
      )}
    </>
  );
}
