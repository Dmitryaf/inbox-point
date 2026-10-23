import type { useOperatorInbox } from '@frontend/features/manage-operator-inbox/model/use-operator-inbox';
import { AsyncMessage } from '@frontend/shared/ui/AsyncMessage';
import styles from '@frontend/widgets/operator-inbox/styles/operator-inbox.module.css';
import { OperatorConversation } from './OperatorConversation';
import { OperatorRequestList } from './OperatorRequestList';
export function OperatorInbox({
  inbox,
}: {
  inbox: ReturnType<typeof useOperatorInbox>;
}) {
  const { state } = inbox;
  const selected = state.requests.find(
    (request) => request.id === state.selectedId,
  );
  return (
    <>
      <AsyncMessage kind="error" text={state.actionError} />
      {state.requests.length > 0 && (
        <section
          className={`card ${styles['operator-inbox']}`}
          aria-labelledby="operator-inbox-title"
        >
          <header className={styles['operator-inbox-heading']}>
            <div>
              <p>
                <span className="status-pill status-pill--attention">
                  Ответы через приложение
                </span>
              </p>
              <h2 id="operator-inbox-title">Входящие обращения</h2>
              <p>
                Здесь можно отвечать, если группа администраторов в Telegram
                недоступна.
              </p>
            </div>
            <span className="status-pill status-pill--neutral">
              Активных: {state.requests.length}
            </span>
          </header>
          <AsyncMessage kind="success" text={state.notice} />
          <div className={styles['operator-inbox-layout']}>
            <OperatorRequestList
              requests={state.requests}
              selectedId={state.selectedId}
              onSelect={inbox.select}
            />
            {selected && (
              <OperatorConversation
                key={selected.id}
                inbox={inbox}
                request={selected}
              />
            )}
          </div>
        </section>
      )}
    </>
  );
}
