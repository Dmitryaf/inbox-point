import { useLayoutEffect, useRef, useState } from 'react';
import { validateContentDraft } from '@frontend-common/entities/content/lib/content-validation';
import { ClassScheduleEditor } from '@frontend/entities/content/ui/ClassScheduleEditor';
import { CustomSectionsEditor } from '@frontend/entities/content/ui/CustomSectionsEditor';
import { InformationEditor } from '@frontend/entities/content/ui/InformationEditor';
import { OrganizationNameField } from '@frontend/entities/content/ui/OrganizationNameField';
import { ContentSummary } from '@frontend/entities/content/ui/ContentSummary';
import { SaveBar } from '@frontend/features/save-content/ui/SaveBar';
import type { useContentWorkspace } from '@frontend/widgets/content-workspace/model/use-content-workspace';
import { ContentHistory } from './ContentHistory';
import { ContentPreview } from './ContentPreview';
import styles from '@frontend/widgets/content-workspace/styles/content-workspace.module.css';

export function EditorPanels({
  editor,
}: {
  editor: ReturnType<typeof useContentWorkspace>;
}) {
  const [section, setSection] = useState<'core' | 'faq' | 'custom'>('core');
  const [preview, setPreview] = useState({ action: 'main', sequence: 0 });
  const focus = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (focus.current) {
      const field = document.getElementById(focus.current);
      const details = field?.closest('details');
      if (details) {
        details.open = true;
      }
      field?.focus();
      focus.current = undefined;
    }
  });
  const draft = editor.draft;
  if (!draft) {
    return null;
  }
  const validation = validateContentDraft(draft);
  const props = { draft, edit: editor.edit, issues: validation.issues };
  function save() {
    const issue = validation.issues[0];
    if (issue) {
      setSection(issue.section);
      focus.current = issue.fieldId;
    }
    void editor.save();
  }
  return (
    <div className={styles.workspace}>
      <OrganizationNameField {...props} />
      <div
        className={styles['editor-navigation']}
        role="group"
        aria-label="Разделы редактора"
      >
        {(
          [
            ['core', 'Занятия'],
            ['faq', 'Информация'],
            ['custom', 'Дополнительные кнопки'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="quiet"
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div hidden={section !== 'core'}>
        <ClassScheduleEditor
          {...props}
          preview={(action) =>
            setPreview((value) => ({ action, sequence: value.sequence + 1 }))
          }
        />
      </div>
      <div hidden={section !== 'faq'}>
        <InformationEditor {...props} revision={editor.draftRevision} />
      </div>
      <div hidden={section !== 'custom'}>
        <CustomSectionsEditor key={editor.draftRevision} {...props} />
      </div>
      <ContentPreview key={preview.sequence} draft={draft} start={preview} />
      <ContentHistory editor={editor} />
      <ContentSummary draft={draft} />
      <SaveBar
        dirty={editor.dirty}
        saving={editor.saving}
        restoring={editor.restoring}
        validationMessage={validation.message}
        onSave={save}
      />
    </div>
  );
}
