import { configure } from 'quasar/wrappers';

export default configure(() => {
  return {
    boot: ['pinia'],

    css: ['app.scss'],

    extras: ['material-icons', 'material-symbols-outlined'],

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
          primary: '#7C3AED',
          secondary: '#1A1C20',
          accent: '#059669',
          dark: '#111318',
          'dark-page': '#0A0C10',
          positive: '#4ADE80',
          negative: '#FFB4AB',
          info: '#0284C7',
          warning: '#FFB875',
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
