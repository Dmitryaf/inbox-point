import { createRoot } from 'react-dom/client';

import App from '@frontend/app/App';
import '@frontend/app/styles/global.css';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Application root is missing');
}
createRoot(root).render(<App />);
