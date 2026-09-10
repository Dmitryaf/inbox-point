import { createApp } from 'vue';

import App from '@frontend/app/App.vue';
import { createAdminRouter } from '@frontend/app/router';
import '@frontend/app/styles/global.css';

createApp(App).use(createAdminRouter()).mount('#app');
