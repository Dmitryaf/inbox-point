import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import {
  type ClientInformationContent,
  hasValidCustomSections,
  hasValidFaqItems,
} from '@/core/application/client-information.js';

const legacyCustomSectionSchema = z.object({
  format: z.literal('faq').optional(),
  label: z.string().min(1).max(40),
  text: z.string().min(1).max(4_000),
});
const customSectionSchema = z.object({
  label: z.string().min(1).max(40),
  text: z.string().min(1).max(4_000),
});
const faqItemSchema = z.object({
  answer: z.string().min(1).max(3_000),
  question: z.string().min(1).max(300),
});
const legacyStoredContentFields = {
  address: z.string().min(1).max(4_000).optional(),
  customSections: z.array(legacyCustomSectionSchema).max(6).optional(),
  prices: z.string().min(1).max(4_000).optional(),
  schedule: z.string().min(1).max(4_000).optional(),
};
const storedContentFields = {
  address: z.string().min(1).max(4_000).optional(),
  customSections: z.array(customSectionSchema).max(6).optional(),
  faq: z.array(faqItemSchema).max(20).optional(),
  prices: z.string().min(1).max(4_000).optional(),
  schedule: z.string().min(1).max(4_000).optional(),
};
const legacyContentPayloadSchema = z.object(legacyStoredContentFields);
const contentPayloadSchema = z.object(storedContentFields);
const contentSectionSchema = z.enum([
  'schedule',
  'prices',
  'address',
  'faq',
  'customSections',
]);
const contentHistoryEntrySchema = z.object({
  changedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  sections: z.array(contentSectionSchema).min(1).max(5),
});
const legacyContentHistoryEntrySchema = z.object({
  changedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  sections: z
    .array(z.enum(['schedule', 'prices', 'address', 'customSections']))
    .min(1)
    .max(4),
});
const storedContentV1Schema = z.object({
  ...legacyStoredContentFields,
  version: z.literal(1),
});
const storedContentV2Schema = z.object({
  content: legacyContentPayloadSchema,
  history: z.array(legacyContentHistoryEntrySchema).max(20),
  version: z.literal(2),
});
const storedContentV3Schema = z.object({
  content: contentPayloadSchema,
  history: z.array(contentHistoryEntrySchema).max(20),
  version: z.literal(3),
});
const storedContentSchema = z.union([
  storedContentV1Schema,
  storedContentV2Schema,
  storedContentV3Schema,
]);

export type ContentSectionKey = z.infer<typeof contentSectionSchema>;

export interface ContentChange {
  changedAt: string;
  sections: readonly ContentSectionKey[];
}

export interface ContentSettingsStore {
  load(): Promise<ClientInformationContent | undefined>;
  loadHistory(): Promise<readonly ContentChange[]>;
  save(content: ClientInformationContent): Promise<void>;
}

interface ContentSettingsDocument {
  content: ClientInformationContent;
  history: readonly ContentChange[];
}

export class FileContentSettingsStore implements ContentSettingsStore {
  public constructor(
    private readonly path: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async load(): Promise<ClientInformationContent | undefined> {
    return (await this.readDocument())?.content;
  }

  public async loadHistory(): Promise<readonly ContentChange[]> {
    return (await this.readDocument())?.history ?? [];
  }

  public async save(content: ClientInformationContent): Promise<void> {
    const validatedContent = pickContent(contentPayloadSchema.parse(content));
    if (
      !hasValidCustomSections(validatedContent.customSections ?? []) ||
      !hasValidFaqItems(validatedContent.faq ?? [])
    ) {
      throw new Error('The local content settings are invalid');
    }

    const current = await this.readDocument();
    const sections = findChangedSections(current?.content ?? {}, content);
    if (sections.length === 0) return;

    const validated = storedContentV3Schema.parse({
      content: validatedContent,
      history: [
        {
          changedAt: this.now().toISOString(),
          sections,
        },
        ...(current?.history ?? []),
      ].slice(0, 20),
      version: 3,
    });
    const directory = dirname(this.path);
    const temporaryPath = this.path + '.' + process.pid + '.tmp';
    await mkdir(directory, { recursive: true });
    await writeFile(
      temporaryPath,
      JSON.stringify(validated, undefined, 2) + '\n',
      { encoding: 'utf8', mode: 0o600 },
    );
    await rename(temporaryPath, this.path);
    await chmod(this.path, 0o600);
  }

  private async readDocument(): Promise<ContentSettingsDocument | undefined> {
    let contents: string;
    try {
      contents = await readFile(this.path, 'utf8');
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') return undefined;
      throw new Error('Unable to read the local content settings');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch {
      throw new Error('The local content settings are invalid');
    }
    const result = storedContentSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error('The local content settings are invalid');
    }

    const content =
      result.data.version === 1
        ? migrateLegacyContent(result.data)
        : result.data.version === 2
          ? migrateLegacyContent(result.data.content)
          : pickContent(result.data.content);
    if (
      !hasValidCustomSections(content.customSections ?? []) ||
      !hasValidFaqItems(content.faq ?? [])
    ) {
      throw new Error('The local content settings are invalid');
    }
    return {
      content: copyContent(content),
      history:
        result.data.version === 1
          ? []
          : result.data.history.map((entry) => ({
              changedAt: entry.changedAt,
              sections: [...entry.sections],
            })),
    };
  }
}

function findChangedSections(
  previous: ClientInformationContent,
  next: ClientInformationContent,
): ContentSectionKey[] {
  const sections: ContentSectionKey[] = [];
  if (previous.schedule !== next.schedule) sections.push('schedule');
  if (previous.prices !== next.prices) sections.push('prices');
  if (previous.address !== next.address) sections.push('address');
  if (JSON.stringify(previous.faq ?? []) !== JSON.stringify(next.faq ?? [])) {
    sections.push('faq');
  }
  if (
    JSON.stringify(previous.customSections ?? []) !==
    JSON.stringify(next.customSections ?? [])
  ) {
    sections.push('customSections');
  }
  return sections;
}

function pickContent(
  value: z.infer<typeof contentPayloadSchema>,
): ClientInformationContent {
  return {
    ...(value.address ? { address: value.address } : {}),
    ...(value.customSections
      ? {
          customSections: value.customSections.map((section) => ({
            label: section.label,
            text: section.text,
          })),
        }
      : {}),
    ...(value.faq ? { faq: value.faq.map((item) => ({ ...item })) } : {}),
    ...(value.prices ? { prices: value.prices } : {}),
    ...(value.schedule ? { schedule: value.schedule } : {}),
  };
}

function migrateLegacyContent(
  value: z.infer<typeof legacyContentPayloadSchema>,
): ClientInformationContent {
  const legacyFaq = value.customSections
    ?.filter((section) => section.format === 'faq')
    .flatMap((section) => parseLegacyFaqText(section.text));
  return {
    ...(value.address ? { address: value.address } : {}),
    ...(value.customSections
      ? {
          customSections: value.customSections
            .filter((section) => section.format !== 'faq')
            .map((section) => ({
              label: section.label,
              text: section.text,
            })),
        }
      : {}),
    ...(legacyFaq && legacyFaq.length > 0 ? { faq: legacyFaq } : {}),
    ...(value.prices ? { prices: value.prices } : {}),
    ...(value.schedule ? { schedule: value.schedule } : {}),
  };
}

function parseLegacyFaqText(
  text: string,
): readonly { answer: string; question: string }[] {
  return text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => {
      const [question = '', ...answer] = block
        .split(/\r?\n/)
        .map((line) => line.trim());
      return {
        answer: answer.filter(Boolean).join('\n'),
        question,
      };
    })
    .filter((item) => item.question && item.answer);
}
function copyContent(
  content: ClientInformationContent,
): ClientInformationContent {
  return {
    ...content,
    ...(content.customSections
      ? {
          customSections: content.customSections.map((section) => ({
            ...section,
          })),
        }
      : {}),
    ...(content.faq ? { faq: content.faq.map((item) => ({ ...item })) } : {}),
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
