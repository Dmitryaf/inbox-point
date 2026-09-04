import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';

import CoreSectionsFields from '@manage/entities/content/ui/CoreSectionsFields';
import CustomSectionsEditor from '@manage/entities/content/ui/CustomSectionsEditor';
import FaqEditor from '@manage/entities/content/ui/FaqEditor';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentEditor.model';

export default function ContentEditor($incomingProps: ComponentProps) {
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  const draft = $state.draft.value;
  return (
    <ModelScopeProvider scope={$scope}>
      <div className="editor">
        <CoreSectionsFields
          modelValue={draft}
          onModelValueChange={($value) => {
            $state.draft.value = $value;
          }}
        />
        <FaqEditor
          modelValue={draft.faq}
          onModelValueChange={($value) => {
            $state.draft.value.faq = $value;
          }}
        />
        <CustomSectionsEditor
          modelValue={draft.customSections}
          onModelValueChange={($value) => {
            $state.draft.value.customSections = $value;
          }}
        />
      </div>
    </ModelScopeProvider>
  );
}
