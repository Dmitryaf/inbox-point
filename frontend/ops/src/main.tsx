import { createRoot } from 'react-dom/client';

import '@ops/app/styles/global.css';
import App from './App';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Application root is missing');
}
createRoot(root).render(<App />);
