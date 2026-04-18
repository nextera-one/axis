import type { IncomingMessage, ServerResponse } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

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

export function createAxisDevProxyPlugin() {
  return {
    name: 'axis-dev-proxy',
    apply: 'serve',
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          handler: (
            req: IncomingMessage,
            res: ServerResponse,
          ) => void | Promise<void>,
        ) => void;
      };
    }) {
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
            const outHeaders: Record<string, string> = {
              'content-length': String(body.length),
            };

            const accept = req.headers.accept;
            const contentType = req.headers['content-type'];
            const authorization = req.headers.authorization;

            if (typeof accept === 'string' && accept.length > 0) {
              outHeaders.accept = accept;
            }
            if (typeof contentType === 'string' && contentType.length > 0) {
              outHeaders['content-type'] = contentType;
            }
            if (typeof authorization === 'string' && authorization.length > 0) {
              outHeaders.authorization = authorization;
            }

            const transport =
              upstreamUrl.protocol === 'https:' ? httpsRequest : httpRequest;

            await new Promise<void>((resolve, reject) => {
              const proxyReq = transport(
                upstreamUrl,
                { method: 'POST', headers: outHeaders },
                (proxyRes) => {
                  const chunks: Buffer[] = [];
                  proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
                  proxyRes.on('end', () => {
                    res.statusCode = proxyRes.statusCode ?? 502;
                    for (const [key, value] of Object.entries(proxyRes.headers)) {
                      if (typeof value === 'string') {
                        setProxyResponseHeader(res, key, value);
                      }
                    }
                    res.end(Buffer.concat(chunks));
                    resolve();
                  });
                  proxyRes.on('error', reject);
                },
              );

              proxyReq.on('error', reject);
              proxyReq.end(body);
            });
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
