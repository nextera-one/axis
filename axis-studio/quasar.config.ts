import { configure } from 'quasar/wrappers';

export default configure(() => {
  return {
    boot: ['pinia'],

    css: ['app.scss'],

    extras: ['material-icons'],

    build: {
      target: { browser: ['es2022', 'chrome100', 'firefox100', 'safari15'] },
      typescript: { strict: true, vueShim: true },
      vueRouterMode: 'history',
      vitePlugins: [],
    },

    devServer: {
      open: false,
      port: 9000,
    },

    framework: {
      config: {
        dark: true,
        brand: {
          primary: '#00e5ff',
          secondary: '#1a1b2e',
          accent: '#a855f7',
          dark: '#0e0e1e',
          'dark-page': '#080812',
          positive: '#22c55e',
          negative: '#ef4444',
          info: '#3b82f6',
          warning: '#f59e0b',
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
