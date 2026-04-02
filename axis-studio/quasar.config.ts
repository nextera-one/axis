import { configure } from 'quasar/wrappers';

export default configure(() => {
  return {
    boot: ['pinia'],

    css: ['app.scss'],

    extras: ['roboto-font', 'material-icons'],

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
          primary: '#00bcd4',
          secondary: '#1a1a2e',
          accent: '#7c4dff',
          dark: '#0f0f23',
          'dark-page': '#0a0a1a',
          positive: '#4caf50',
          negative: '#f44336',
          info: '#2196f3',
          warning: '#ff9800',
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
