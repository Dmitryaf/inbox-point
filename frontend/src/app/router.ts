import {
  createRouter,
  createWebHistory,
  type Router,
  type RouterHistory,
  type RouteRecordRaw,
} from '@frontend/shared/lib/router';

import AdminLoginPage from '@frontend/pages/admin-login/ui/AdminLoginPage';
import ContentManagementPage from '@frontend/pages/content-management/ui/ContentManagementPage';
import NotFoundPage from '@frontend/pages/not-found/ui/NotFoundPage';
import OperationsDashboardPage from '@frontend/pages/operations-dashboard/ui/OperationsDashboardPage';
import SetupPage from '@frontend/pages/setup/ui/SetupPage';
import AdminShell from '@frontend/widgets/admin-shell/ui/AdminShell';

const routes: readonly RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: AdminLoginPage,
    meta: { documentTitle: 'Вход в управление — Messenger Handoff' },
  },
  {
    path: '/',
    component: AdminShell,
    redirect: '/manage',
    children: [
      {
        path: 'manage',
        name: 'manage',
        component: ContentManagementPage,
        meta: {
          adminSection: 'answers',
          description: 'Настройте готовые ответы для Telegram и VK.',
          documentTitle: 'Ответы клиентам — Messenger Handoff',
          pageTitle: 'Ответы клиентам',
        },
      },
      {
        path: 'setup',
        name: 'setup',
        component: SetupPage,
        meta: {
          adminSection: 'channels',
          description: 'Подключения Telegram и VK.',
          documentTitle: 'Каналы — Messenger Handoff',
          pageTitle: 'Каналы',
        },
      },
      {
        path: 'ops',
        name: 'ops',
        component: OperationsDashboardPage,
        meta: {
          adminSection: 'monitoring',
          description: 'Каналы, доставка и резервные обращения.',
          documentTitle: 'Состояние сервиса — Messenger Handoff',
          pageTitle: 'Состояние сервиса',
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundPage,
    meta: { documentTitle: 'Страница не найдена — Messenger Handoff' },
  },
];

export function createAdminRouter(
  history: RouterHistory = createWebHistory(),
): Router {
  const router = createRouter({ history, routes: [...routes] });
  router.afterEach((route) => {
    document.title =
      typeof route.meta.documentTitle === 'string'
        ? route.meta.documentTitle
        : 'Messenger Handoff';
  });
  return router;
}
