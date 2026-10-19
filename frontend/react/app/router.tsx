import { useEffect } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
  type RouteObject,
} from 'react-router';

import {
  documentTitle,
  sections,
} from '@frontend/entities/navigation/model/sections';
import { AdminLoginPage } from '@frontend/pages/admin-login/ui/AdminLoginPage';
import { NotFoundPage } from '@frontend/pages/not-found/ui/NotFoundPage';
import { SectionPreview } from '@frontend/pages/section-preview/ui/SectionPreview';
import { AdminShell } from '@frontend/widgets/admin-shell/ui/AdminShell';
import { ContentManagementPage } from '@frontend/pages/content-management/ui/ContentManagementPage';
import { AnalyticsPage } from '@frontend/pages/analytics/ui/AnalyticsPage';
import { SetupPage } from '@frontend/pages/setup/ui/SetupPage';

function RouteFrame() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = documentTitle(pathname);
  }, [pathname]);
  return <Outlet />;
}

export const adminRoutes: RouteObject[] = [
  {
    element: <RouteFrame />,
    children: [
      { path: '/login', element: <AdminLoginPage /> },
      {
        path: '/',
        element: <AdminShell />,
        children: [
          { index: true, element: <Navigate to="/manage" replace /> },
          ...sections.map((section) => ({
            path: section.path.slice(1),
            element:
              section.path === '/manage' ? (
                <ContentManagementPage />
              ) : section.path === '/analytics' ? (
                <AnalyticsPage />
              ) : section.path === '/setup' ? (
                <SetupPage />
              ) : (
                <SectionPreview />
              ),
          })),
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAdminRouter() {
  return createBrowserRouter(adminRoutes);
}
