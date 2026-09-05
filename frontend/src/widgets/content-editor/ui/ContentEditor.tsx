import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import {
  modelSetter as $setter,
  propertySetter as $propertySetter,
} from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import CoreSectionsFields from '@frontend/entities/content/ui/CoreSectionsFields';
import CustomSectionsEditor from '@frontend/entities/content/ui/CustomSectionsEditor';
import FaqEditor from '@frontend/entities/content/ui/FaqEditor';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentEditor.model';

export default function ContentEditor($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const draft = $state.draft.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <div {...$attributes} className={$class('editor', $attributes.className)}>
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
      </div>
    </ModelScopeProvider>
  );
}
