import { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', redirect: '/sender' },
      {
        path: 'sender',
        component: () => import('pages/IntentSender.vue'),
        meta: { title: 'Intent Sender' },
      },
      {
        path: 'registry',
        component: () => import('pages/RegistryExplorer.vue'),
        meta: { title: 'Registry Explorer' },
      },
      {
        path: 'auth',
        component: () => import('pages/AuthManager.vue'),
        meta: { title: 'Auth Manager' },
      },
      {
        path: 'history',
        component: () => import('pages/HistoryPage.vue'),
        meta: { title: 'History' },
      },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
