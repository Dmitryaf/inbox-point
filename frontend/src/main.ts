import { createApp } from 'vue';

import App from '@frontend/App.vue';
import '@frontend/app/styles/global.css';

if (window.location.pathname.startsWith('/ops')) {
  document.title = 'Состояние сервиса';
} else if (window.location.pathname.startsWith('/setup')) {
  document.title = 'Настройка сервиса';
} else {
  document.title = 'Информация в каналах';
}

createApp(App).mount('#app');
