import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@frontend/app/App';
import { createAppQueryClient } from '@frontend/app/query-client';
import { createAdminRouter } from '@frontend/app/router';
import '@frontend-styles/global.css';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Application root is missing');
}

createRoot(container).render(
  <StrictMode>
    <App router={createAdminRouter()} queryClient={createAppQueryClient()} />
  </StrictMode>,
);
