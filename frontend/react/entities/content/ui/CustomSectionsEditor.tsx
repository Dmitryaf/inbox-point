import { useCollectionEditor } from '@frontend/entities/content/model/use-collection-editor';
import type { ContentEditorProps } from '@frontend/entities/content/model/editor-props';
import { ContentField } from './ContentField';
import { CustomSectionPurpose } from './CustomSectionPurpose';
import styles from '@frontend/entities/content/styles/collection-editor.module.css';

export function CustomSectionsEditor({
  draft,
  edit,
  issues = [],
}: ContentEditorProps) {
  const sections = draft.customSections;
  const { keys, add, move, remove } = useCollectionEditor(
    sections,
    (customSections) => edit({ customSections }),
    {
      create: () => ({ id: crypto.randomUUID(), label: '', text: '' }),
      limit: 6,
      prefix: 'section-label',
      description: (item, index) =>
        `раздел «${item.label.trim() || index + 1}»`,
      hasContent: (item) => !!(item.label.trim() || item.text.trim()),
    },
  );
  function change(index: number, patch: Partial<(typeof sections)[number]>) {
    edit({
      customSections: sections.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  }
  return (
    <section className="card" aria-label="Дополнительные разделы">
      <div className={styles['section-heading']}>
        <h2>Дополнительные разделы</h2>
        <span>{sections.length} / 6</span>
      </div>
      {!sections.length && (
        <p className={styles.empty}>Дополнительных разделов пока нет.</p>
      )}
      {sections.map((section, index) => (
        <fieldset key={keys[index]} className={styles['item-card']}>
          <legend>Раздел {index + 1}</legend>
          <ContentField
            id={`section-label-${index}`}
            label="Название кнопки"
            value={section.label}
            onChange={(label) => change(index, { label })}
            maxLength={40}
            issues={issues}
          />
          <p className={styles.counter}>{section.label.length} / 40</p>
          <CustomSectionPurpose
            name={`section-mode-${keys[index]}`}
            mode={section.mode}
            change={(mode) => change(index, { mode })}
          />
          <ContentField
            id={`section-text-${index}`}
            label={
              section.mode === 'application'
                ? 'Что спросить у клиента?'
                : 'Текст ответа'
            }
            value={section.text}
            onChange={(text) => change(index, { text })}
            maxLength={4000}
            issues={issues}
            multiline
          />
          <p className={styles.counter}>{section.text.length} / 4000</p>
          <div className={styles['item-actions']}>
            <button
              type="button"
              className="quiet"
              disabled={index === 0}
              aria-label={`Переместить раздел ${index + 1} выше`}
              data-move="-1"
              onClick={() => move(index, -1)}
            >
              Выше
            </button>
            <button
              type="button"
              className="quiet"
              disabled={index === sections.length - 1}
              aria-label={`Переместить раздел ${index + 1} ниже`}
              data-move="1"
              onClick={() => move(index, 1)}
            >
              Ниже
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => remove(index)}
            >
              Удалить раздел
            </button>
          </div>
        </fieldset>
      ))}
      <button
        id="add-section-label"
        type="button"
        disabled={sections.length >= 6}
        onClick={add}
      >
        Добавить раздел
      </button>
    </section>
  );
}
