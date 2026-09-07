import { createRoot } from 'react-dom/client';

import App from '@frontend/App';
import '@frontend/app/styles/global.css';

if (window.location.pathname.startsWith('/ops')) {
  document.title = 'Состояние сервиса';
} else if (window.location.pathname.startsWith('/setup')) {
  document.title = 'Настройка сервиса';
} else {
  document.title = 'Информация в каналах';
}

const root = document.getElementById('app');
if (!root) {
  throw new Error('Application root is missing');
}
createRoot(root).render(<App />);
