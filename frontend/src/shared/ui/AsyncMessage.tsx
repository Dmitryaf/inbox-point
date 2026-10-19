export function AsyncMessage({
  kind,
  text,
}: {
  kind: 'error' | 'success' | 'info';
  text: string;
}) {
  return text ? (
    <p
      className={`message message--${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {text}
    </p>
  ) : null;
}
