import { createRoot } from 'react-dom/client';

import App from '@frontend/App';
import '@frontend/app/styles/global.css';

if (window.location.pathname.startsWith('/ops')) {
  document.title = 'Состояние — Messenger Handoff';
} else if (window.location.pathname.startsWith('/setup')) {
  document.title = 'Каналы — Messenger Handoff';
} else {
  document.title = 'Информация — Messenger Handoff';
}

const root = document.getElementById('app');
if (!root) {
  throw new Error('Application root is missing');
}
createRoot(root).render(<App />);
