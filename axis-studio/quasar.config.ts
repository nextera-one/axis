import { configure } from 'quasar/wrappers';

import { createAxisDevProxyPlugin } from './build/axis-dev-proxy';

export default configure(() => {
  return {
    boot: ['pinia'],

    css: ['app.scss'],

    extras: ['material-icons', 'material-symbols-outlined'],

    build: {
      target: { browser: ['es2022', 'chrome100', 'firefox100', 'safari15'] },
      typescript: { strict: true, vueShim: true },
      vueRouterMode: 'history',
      vitePlugins: [createAxisDevProxyPlugin()],
    },

    devServer: {
      open: false,
      port: 9000,
    },

    framework: {
      config: {
        dark: true,
        brand: {
          primary: '#A855F7',
          secondary: '#120C28',
          accent: '#06FFA5',
          dark: '#080414',
          'dark-page': '#030108',
          positive: '#06FFA5',
          negative: '#FF5C8A',
          info: '#38BDF8',
          warning: '#FFB547',
        },
      },
      plugins: [
        'Notify',
        'Dialog',
        'LocalStorage',
        'SessionStorage',
        'Loading',
      ],
    },

    animations: [],
    ssr: { pwa: false },
    pwa: {},
    capacitor: {},
    electron: {},
    bex: {},
  };
});
