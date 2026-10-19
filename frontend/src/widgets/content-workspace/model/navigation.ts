export type WorkspaceView = 'edit' | 'preview' | 'history';
export type EditorSection = 'core' | 'faq' | 'custom';
export const workspaceViews = [
  { id: 'edit', label: 'Редактирование' },
  { id: 'preview', label: 'Предпросмотр' },
  { id: 'history', label: 'История' },
] as const;
export const editorSections = [
  { id: 'core', label: 'Занятия' },
  { id: 'faq', label: 'Информация' },
  { id: 'custom', label: 'Дополнительные кнопки' },
] as const;
