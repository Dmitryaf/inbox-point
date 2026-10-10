import { reactive } from 'vue';
import { createEmptyContent } from '@frontend/entities/content/model/content-draft';
export function populated() {
  const draft = reactive(createEmptyContent());
  draft.directions.push({ id: 'dance', name: 'Тестовый танец' });
  draft.groups.push({
    id: 'group',
    directionId: 'dance',
    name: 'Начинающие',
    meetings: ['Пн 19:00'],
    description: '',
    enrollmentOpen: false,
    applicationQuestion: '',
  });
  return draft;
}
