import type { ClientInformationContent } from '@/core/application/client-information.js';
export function classContent(): ClientInformationContent {
  return {
    directions: [{ id: 'dance', name: 'Тестовый танец' }],
    groups: [
      {
        id: 'beginners',
        directionId: 'dance',
        name: 'Начинающие',
        meetings: ['Понедельник, 19:00', 'Четверг, 19:00'],
        description: 'Занятия с нуля.',
        enrollmentOpen: true,
        applicationQuestion: 'Когда хотите прийти?',
      },
    ],
    keywords: [
      { phrase: 'Тестовый танец', targetType: 'group', targetId: 'beginners' },
      { phrase: 'Все группы', targetType: 'direction', targetId: 'dance' },
    ],
    prices: 'Пробное занятие — 500',
    address: 'Тестовый адрес',
    schedule: [
      {
        title: 'Старая карточка',
        dayTime: 'Суббота, 12:00',
        description: 'Сохранённое описание.',
      },
    ],
  };
}
