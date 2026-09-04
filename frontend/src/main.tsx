import { createRoot } from 'react-dom/client';

import App from '@frontend/App';
import '@frontend/app/styles/global.css';

document.title = window.location.pathname.startsWith('/ops')
  ? 'Состояние сервиса'
  : 'Информация для клиентов';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Application root is missing');
}
createRoot(root).render(<App />);
