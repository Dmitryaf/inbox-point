export interface AdminSection {
  path: string;
  label: string;
  title: string;
  intro: string;
}

const answers: AdminSection = {
  path: '/manage',
  label: 'Ответы',
  title: 'Ответы клиентам',
  intro: 'Настройте готовые ответы для Telegram и VK.',
};

export const sections: readonly AdminSection[] = [
  answers,
  {
    path: '/setup',
    label: 'Каналы',
    title: 'Каналы',
    intro: 'Подключения Telegram и VK.',
  },
  {
    path: '/analytics',
    label: 'Аналитика',
    title: 'Аналитика',
    intro: 'Как пользователи взаимодействуют с ботами.',
  },
  {
    path: '/ops',
    label: 'Мониторинг',
    title: 'Состояние сервиса',
    intro: 'Каналы, доставка и резервные обращения.',
  },
];

export function currentSection(path: string): AdminSection {
  return (
    sections.find((section) => section.path === path.replace(/\/$/, '')) ??
    answers
  );
}

export function documentTitle(path: string): string {
  if (path === '/login') {
    return 'Вход в управление — Inbox Point';
  }
  const section = sections.find(
    (item) => item.path === path.replace(/\/$/, ''),
  );
  return `${section?.title ?? 'Страница не найдена'} — Inbox Point`;
}
