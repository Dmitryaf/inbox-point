import { RouterHost } from '@frontend/shared/lib/router';
import { createRoot } from 'react-dom/client';

import App from '@frontend/app/App';
import { createAdminRouter } from '@frontend/app/router';
import '@frontend/app/styles/global.css';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Application root is missing');
}
createRoot(root).render(
  <RouterHost router={createAdminRouter()}>
    <App />
  </RouterHost>,
);
