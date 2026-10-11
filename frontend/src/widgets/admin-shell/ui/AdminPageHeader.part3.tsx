import { unref as $unref } from '@frontend/shared/lib/model-state';

import { organizationName } from '@frontend/entities/content/model/organization-name';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './AdminPageHeader.model';
export function renderAdminPageHeaderPart3(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <div className="admin-page-heading" data-r-e15afcb7="">
        {$unref(organizationName) ? (
          <p className="organization-name" data-r-e15afcb7="">
            {$unref(organizationName)}
          </p>
        ) : null}
        <h1 data-r-e15afcb7="">{$props.title}</h1>
        {$props.intro ? (
          <p className="page-intro" data-r-e15afcb7="">
            {$props.intro}
          </p>
        ) : null}
      </div>
    </>
  );
}
