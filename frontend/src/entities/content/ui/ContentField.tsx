import type { ContentValidationIssue } from '@frontend-common/entities/content/model/types';

export function ContentField({
  id,
  label,
  value,
  onChange,
  multiline = false,
  maxLength,
  issues,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength: number;
  issues: readonly ContentValidationIssue[];
}) {
  const error = issues.find((issue) => issue.fieldId === id)?.message;
  const props = {
    id,
    value,
    maxLength,
    'aria-invalid': !!error,
    'aria-describedby': error ? `${id}-error` : undefined,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };
  return (
    <>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...props} rows={4} />
      ) : (
        <input
          {...props}
          autoComplete={id === 'organization-name' ? 'organization' : 'off'}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="message message--error">
          {error}
        </p>
      )}
    </>
  );
}
