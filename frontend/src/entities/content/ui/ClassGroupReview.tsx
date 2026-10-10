import '@frontend/entities/content/styles/class-editor.react-data-r-3333923b.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderClassGroupReviewPart1 } from './ClassGroupReview.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassGroupReview.model';

export default function ClassGroupReview($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  return (
    <ModelScopeProvider scope={$scope}>
      {renderClassGroupReviewPart1($state, $props)}
    </ModelScopeProvider>
  );
}
