import type { ContentEditorProps } from '@frontend/entities/content/model/editor-props';
import { ContentField } from './ContentField';
export function OrganizationNameField({
  draft,
  edit,
  issues = [],
}: ContentEditorProps) {
  return (
    <section className="card" aria-label="Организация">
      <ContentField
        id="organization-name"
        label="Название организации"
        value={draft.organizationName ?? ''}
        onChange={(organizationName) => edit({ organizationName })}
        maxLength={120}
        issues={issues}
      />
    </section>
  );
}
