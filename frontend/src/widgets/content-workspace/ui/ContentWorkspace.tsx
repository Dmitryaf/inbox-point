import { useContentWorkspace } from '@frontend/widgets/content-workspace/model/use-content-workspace';
import { EditorPanels } from './EditorPanels';

export function ContentWorkspace() {
  const editor = useContentWorkspace();

  return (
    <>
      {editor.error && (
        <p className="message message--error" role="alert">
          {editor.error}
        </p>
      )}
      {editor.notice && (
        <p className="message message--success" role="status">
          {editor.notice}
        </p>
      )}
      {editor.historyError && (
        <p className="message message--error" role="alert">
          {editor.historyError}
        </p>
      )}
      {editor.loading ? (
        <p role="status" className="card">
          Загружаем информацию…
        </p>
      ) : !editor.draft ? (
        <section className="card">
          <p>Редактор не открыт. Повторите загрузку.</p>
          <button
            type="button"
            onClick={() => {
              void editor.load();
            }}
          >
            Повторить
          </button>
        </section>
      ) : (
        <EditorPanels editor={editor} />
      )}
    </>
  );
}
