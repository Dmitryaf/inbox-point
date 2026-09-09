import { createApp } from 'vue';

import App from '@frontend/App.vue';
import '@frontend/app/styles/global.css';

if (window.location.pathname.startsWith('/ops')) {
  document.title = 'Состояние — Messenger Handoff';
} else if (window.location.pathname.startsWith('/setup')) {
  document.title = 'Каналы — Messenger Handoff';
} else {
  document.title = 'Информация — Messenger Handoff';
}

createApp(App).mount('#app');
