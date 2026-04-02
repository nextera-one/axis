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
          primary:   '#2dd4a8',
          secondary: '#131720',
          accent:    '#20b2aa',
          dark:      '#131720',
          'dark-page': '#0b0d12',
          positive: '#22c976',
          negative: '#ea5455',
          info:     '#05c0cf',
          warning:  '#ff9f43',
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
