import '@frontend/widgets/operator-inbox/styles/operator-conversation.react-data-r-e21483db.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderOperatorConversationPart1 } from './OperatorConversation.part1';
import { renderOperatorConversationPart2 } from './OperatorConversation.part2';
import { renderOperatorConversationPart3 } from './OperatorConversation.part3';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperatorConversation.model';

export default function OperatorConversation($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <article
        {...$attributes}
        className={$class('operator-conversation', $attributes.className)}
        data-r-e21483db=""
      >
        {renderOperatorConversationPart1($state, $props)}
        {renderOperatorConversationPart2($state, $props)}
        {renderOperatorConversationPart3($state, $props)}
      </article>
    </ModelScopeProvider>
  );
}
