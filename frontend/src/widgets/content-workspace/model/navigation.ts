export type WorkspaceView = 'edit' | 'preview' | 'history';

export type EditorSection = 'core' | 'faq' | 'custom';

export const workspaceViews: readonly {
  id: WorkspaceView;
  label: string;
}[] = [
  { id: 'edit', label: 'Редактирование' },
  { id: 'preview', label: 'Предпросмотр' },
  { id: 'history', label: 'История' },
];

export const editorSections: readonly {
  id: EditorSection;
  label: string;
}[] = [
  { id: 'core', label: 'Основное' },
  { id: 'faq', label: 'Частые вопросы' },
  { id: 'custom', label: 'Свои разделы' },
];
