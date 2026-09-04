import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';

import {
  setModelValue as $set,
  requiredValue as $required,
} from '@manage/shared/lib/component-bindings';

import CoreSectionsFields from '@manage/entities/content/ui/CoreSectionsFields';
import CustomSectionsEditor from '@manage/entities/content/ui/CustomSectionsEditor';
import FaqEditor from '@manage/entities/content/ui/FaqEditor';

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
  return (
    <ModelScopeProvider scope={$scope}>
      <div className="editor">
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
              $required($state.draft.value).faq = $value;
            }}
          />
        ) : (
          <CustomSectionsEditor
            modelValue={draft.customSections}
            onModelValueChange={($value) => {
              $required($state.draft.value).customSections = $value;
            }}
          />
        )}
      </div>
    </ModelScopeProvider>
  );
}
