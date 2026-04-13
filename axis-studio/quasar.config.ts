import type { IncomingMessage, ServerResponse } from 'node:http';

import { configure } from "quasar/wrappers";

const AXIS_DEV_PROXY_PATH = '/axis';
const AXIS_DEV_PROXY_TARGET_HEADER = 'x-axis-proxy-target';

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function setProxyResponseHeader(
  res: ServerResponse,
  key: string,
  value: string,
) {
  const lower = key.toLowerCase();
  if (
    lower === 'connection' ||
    lower === 'content-length' ||
    lower === 'keep-alive' ||
    lower === 'transfer-encoding'
  ) {
    return;
  }
  res.setHeader(key, value);
}

function axisDevProxyPlugin() {
  return {
    name: 'axis-dev-proxy',
    apply: 'serve',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>) => void } }) {
      server.middlewares.use(
        AXIS_DEV_PROXY_PATH,
        async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Method Not Allowed');
            return;
          }

          const target = req.headers[AXIS_DEV_PROXY_TARGET_HEADER];

          if (typeof target !== 'string' || target.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Missing AXIS proxy target');
            return;
          }

          let upstreamUrl: URL;
          try {
            upstreamUrl = new URL(target);
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Invalid AXIS proxy target');
            return;
          }

          if (!['http:', 'https:'].includes(upstreamUrl.protocol)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Unsupported AXIS proxy protocol');
            return;
          }

          if (
            req.headers.host &&
            upstreamUrl.host === req.headers.host &&
            upstreamUrl.pathname === AXIS_DEV_PROXY_PATH
          ) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Refusing AXIS proxy loop');
            return;
          }

          try {
            const body = await readRequestBody(req);
            const requestHeaders = new Headers();
            const accept = req.headers.accept;
            const contentType = req.headers['content-type'];
            const authorization = req.headers.authorization;

            if (typeof accept === 'string' && accept.length > 0) {
              requestHeaders.set('accept', accept);
            }
            if (typeof contentType === 'string' && contentType.length > 0) {
              requestHeaders.set('content-type', contentType);
            }
            if (typeof authorization === 'string' && authorization.length > 0) {
              requestHeaders.set('authorization', authorization);
            }

            const upstream = await fetch(upstreamUrl, {
              method: 'POST',
              headers: requestHeaders,
              body,
            });
            const buffer = Buffer.from(await upstream.arrayBuffer());

            res.statusCode = upstream.status;
            upstream.headers.forEach((value, key) => {
              setProxyResponseHeader(res, key, value);
            });
            res.end(buffer);
          } catch (error) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(
              error instanceof Error
                ? `AXIS proxy error: ${error.message}`
                : 'AXIS proxy error',
            );
          }
        },
      );
    },
  };
}

export default configure(() => {
  return {
    boot: ["pinia"],

    css: ["app.scss"],

    extras: ["material-icons", "material-symbols-outlined"],

    build: {
      target: { browser: ["es2022", "chrome100", "firefox100", "safari15"] },
      typescript: { strict: true, vueShim: true },
      vueRouterMode: "history",
      vitePlugins: [axisDevProxyPlugin()],
    },

    devServer: {
      open: false,
      port: 9000,
    },

    framework: {
      config: {
        dark: true,
        brand: {
          primary: "#A855F7",
          secondary: "#120C28",
          accent: "#06FFA5",
          dark: "#080414",
          "dark-page": "#030108",
          positive: "#06FFA5",
          negative: "#FF5C8A",
          info: "#38BDF8",
          warning: "#FFB547",
        },
      },
      plugins: [
        "Notify",
        "Dialog",
        "LocalStorage",
        "SessionStorage",
        "Loading",
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
