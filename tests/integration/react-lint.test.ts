import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { expect, it } from 'vitest';

const eslint = new ESLint({
  overrideConfig: [tseslint.configs.disableTypeChecked],
});

it('keeps common HTTP and session code independent of frontend frameworks', async () => {
  const results = await eslint.lintText(
    "import { createApp } from 'vue'; export { createApp };",
    { filePath: 'frontend/common/shared/api/framework-probe.ts' },
  );
  expect(
    results.flatMap((result) =>
      result.messages.map((message) => message.ruleId),
    ),
  ).toContain('no-restricted-imports');
});

it('permits lower layer imports and rejects upward imports in React TSX', async () => {
  const filePath = 'frontend/react/shared/lib/boundary-probe.tsx';
  const allowed = await eslint.lintText(
    "import { value } from '@frontend/shared/lib/value'; export { value };",
    { filePath },
  );
  expect(allowed.flatMap((result) => result.messages)).toEqual([]);
  const forbidden = await eslint.lintText(
    "import { value } from '@frontend/features/example/model/value'; export { value };",
    { filePath },
  );
  expect(
    forbidden.flatMap((result) =>
      result.messages.map((message) => message.ruleId),
    ),
  ).toContain('no-restricted-imports');
});

it('detects conditional hooks in React TSX', async () => {
  const results = await eslint.lintText(
    "import { useState } from 'react'; export function Probe({ enabled }: { enabled: boolean }) { if (enabled) { useState(0); } return null; }",
    { filePath: 'frontend/react/app/HookProbe.tsx' },
  );
  expect(
    results.flatMap((result) =>
      result.messages.map((message) => message.ruleId),
    ),
  ).toContain('react-hooks/rules-of-hooks');
});
