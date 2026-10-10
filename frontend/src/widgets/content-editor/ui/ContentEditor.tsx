import '@frontend/widgets/content-editor/styles/content-editor.react-data-r-7c201b3b.css';
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

import CustomSectionsEditor from '@frontend/entities/content/ui/CustomSectionsEditor';

import ClassScheduleEditor from '@frontend/entities/content/ui/ClassScheduleEditor';

import { renderContentEditorPart1 } from './ContentEditor.part1';
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
      <div
        {...$attributes}
        className={$class('editor', $attributes.className)}
        data-r-7c201b3b=""
      >
        <ClassScheduleEditor
          modelValue={draft}
          onModelValueChange={$setter($state, 'draft')}
          style={Object.assign(
            {},
            { display: $props.activeSection === 'core' ? undefined : 'none' },
          )}
          data-r-7c201b3b=""
        />
        {renderContentEditorPart1($state, $props)}
        <CustomSectionsEditor
          errors={$props.errors}
          modelValue={draft.customSections}
          onModelValueChange={$propertySetter(
            () => $state.draft.value,
            'customSections',
          )}
          style={Object.assign(
            {},
            { display: $props.activeSection === 'custom' ? undefined : 'none' },
          )}
          data-r-7c201b3b=""
        />
      </div>
    </ModelScopeProvider>
  );
}
