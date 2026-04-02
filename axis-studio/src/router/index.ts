import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
} from 'vue-router';
import routes from './routes';

export default function () {
  const createHistory =
    typeof window !== 'undefined' ? createWebHistory : createMemoryHistory;

  return createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });
}
