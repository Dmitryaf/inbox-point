import type { useContentWorkspace } from '@frontend/widgets/content-workspace/model/use-content-workspace';
import { ContentRevision } from '@frontend/entities/content/ui/ContentRevision';

export function ContentHistory({
  editor,
}: {
  editor: ReturnType<typeof useContentWorkspace>;
}) {
  return (
    <section className="card">
      <h2>Предыдущие версии</h2>
      {editor.historyLoading ? (
        <p role="status">Обновляем историю…</p>
      ) : (
        <button
          className="quiet"
          type="button"
          onClick={() => {
            void editor.refreshHistory();
          }}
        >
          Обновить историю
        </button>
      )}
      {!editor.historyLoading &&
        !editor.historyError &&
        !editor.history.length && <p>Изменений пока нет.</p>}
      <ol>
        {editor.history.map((change, index) => (
          <li key={`${change.changedAt}-${change.revision ?? index}`}>
            <span>
              {new Intl.DateTimeFormat('ru-RU', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(change.changedAt))}{' '}
              · Версия {change.revision ?? 'неизвестна'}
            </span>
            {index === 0 ? (
              <small> Текущая версия</small>
            ) : (
              change.revision && (
                <button
                  className="quiet"
                  type="button"
                  disabled={editor.saving || editor.restoring}
                  onClick={() => {
                    void editor.previewRevision(change.revision!);
                  }}
                >
                  Посмотреть версию
                </button>
              )
            )}
          </li>
        ))}
      </ol>
      {editor.previewLoading && <p role="status">Загружаем версию…</p>}
      {(editor.previewLoading || editor.preview) && (
        <button
          type="button"
          className="quiet"
          disabled={editor.restoring}
          onClick={editor.cancelPreview}
        >
          Отмена
        </button>
      )}
      {editor.preview && (
        <section aria-label="Просмотр версии">
          <ContentRevision snapshot={editor.preview} />
          <p>
            Заменить все разделы, включая скрытые, этой версией? После
            восстановления информация сразу появится в Telegram и VK.
          </p>
          {editor.dirty && (
            <p className="warning-text">
              Несохранённые изменения будут потеряны.
            </p>
          )}
          <button
            type="button"
            disabled={
              editor.restoring || editor.saving || editor.previewLoading
            }
            onClick={() => {
              if (editor.reviewedRevision) {
                void editor.restore(editor.reviewedRevision);
              }
            }}
          >
            {editor.restoring ? 'Восстанавливаем…' : 'Да, восстановить'}
          </button>
        </section>
      )}
    </section>
  );
}
