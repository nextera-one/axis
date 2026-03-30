# AXIS Proxy

High-performance protocol gateway that translates REST requests to AXIS binary protocol.

## Features

- **REST → AXIS Translation**: Convert JSON REST requests to AXIS binary frames
- **Binary Passthrough**: Forward raw AXIS frames to backend
- **Rate Limiting**: Sliding window rate limiter with configurable limits per IP
- **Circuit Breaker**: Automatic backend failure detection with graceful degradation
- **Prometheus Metrics**: Export metrics in Prometheus format for monitoring
- **Structured Logging**: JSON logs with correlation IDs for request tracing
- **CORS Support**: Configurable cross-origin resource sharing
- **Kubernetes Ready**: Health, readiness, and liveness probes
- **Graceful Shutdown**: Clean shutdown with connection draining

## Quick Start

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build and start production
npm run build
npm start
```

## Configuration

Set via environment variables:

| Variable                  | Default                        | Description                             |
| ------------------------- | ------------------------------ | --------------------------------------- |
| `AXIS_PROXY_PORT`         | 7777                           | Port to listen on                       |
| `AXIS_BACKEND_URL`        | http://localhost:3000/api/axis | Backend AXIS server                     |
| `AXIS_PROXY_MODE`         | hybrid                         | Mode: translate, passthrough, hybrid    |
| `AXIS_SIGN_REQUESTS`      | false                          | Sign outgoing requests                  |
| `AXIS_SIGNING_KEY`        | -                              | Private key for signing (hex)           |
| `AXIS_RATE_LIMIT`         | 100                            | Requests per minute per IP              |
| `AXIS_REQUEST_TIMEOUT_MS` | 30000                          | Backend request timeout                 |
| `AXIS_DEBUG`              | false                          | Enable debug logging                    |
| `CORS_ORIGIN`             | \*                             | Allowed origins (comma-separated or \*) |
| `CORS_METHODS`            | GET,POST,OPTIONS               | Allowed HTTP methods                    |

## Endpoints

### Health & Monitoring

```
GET /health          # Health check with circuit breaker status
GET /ready           # Kubernetes readiness probe
GET /live            # Kubernetes liveness probe
GET /info            # Proxy info and circuit breaker stats
GET /metrics         # Prometheus metrics
GET /metrics/json    # JSON metrics summary
```

### Admin

```
POST /admin/circuit/reset    # Reset circuit breaker
GET  /debug/requests         # Recent requests (debug mode only)
```

### REST → AXIS Translation

```
POST /api/{intent}
Content-Type: application/json
X-Actor-Id: <actor-id-hex>
X-Proof-Type: 1
X-Capsule-Id: <capsule-id-hex>
X-Session-Id: <session-uid>
X-Device-Uid: <device-uid>
X-Identity-Uid: <identity-uid>
X-Auth-Level: <session|session_browser|step_up|primary_device>
X-Kid: <key-id>
X-Requested-Trust: <ephemeral_session|trusted_device>
X-Tps-Coordinate: <temporal-presence-coordinate>
X-Challenge-Uid: <challenge-uid>
X-Browser-Public-Key: <base64url-spki>
X-Browser-Key-Algorithm: <ed25519|p256>
X-Browser-Proof-Signature: <base64url-signature>
X-Mobile-Device-Uid: <device-uid>

{
  "field": "value"
}
```

The intent path uses dots as separators: `/api/passport/issue` → `passport.issue`

For NestFlow-aware requests, the proxy forwards additional context fields into the AXIS payload:

- `_sessionId`
- `_deviceUid`
- `_identityUid`
- `_authLevel`
- `_requestedTrust`
- `_tpsCoordinate`

The proxy can also map QR helper headers into JSON body fields for `axis.auth.qr.*` requests:

- `challengeUid`
- `browserPublicKey`
- `browserKeyAlgorithm`
- `browserProofSignature`
- `mobileDeviceUid`

### Binary Passthrough

```
POST /axis
Content-Type: application/axis-bin

<raw AXIS binary frame>
```

## Example

```bash
# Translate REST to AXIS
curl -X POST http://localhost:7777/api/public.ping \
  -H "Content-Type: application/json" \
  -H "X-Actor-Id: 00000000000000000000000000000001" \
  -d '{"message": "hello"}'

# Response includes correlation ID
{
  "effect": "complete",
  "data": { "pong": true },
  "correlationId": "a1b2c3d4e5f6g7h8"
}

# Check metrics
curl http://localhost:7777/metrics

# Check circuit breaker status
curl http://localhost:7777/info
```

## Architecture

```
┌─────────────┐     ┌─────────────────────────────────┐     ┌─────────────┐
│ REST Client │────▶│         AXIS Proxy              │────▶│ AXIS Backend│
│   (JSON)    │◀────│                                 │◀────│  (Binary)   │
└─────────────┘     │  ┌───────┐ ┌────────┐ ┌──────┐ │     └─────────────┘
                    │  │ Rate  │ │Circuit │ │Metric│ │
                    │  │Limiter│ │Breaker │ │  s   │ │
                    │  └───────┘ └────────┘ └──────┘ │
                    └─────────────────────────────────┘
```

## Rate Limiting

The proxy implements a sliding window rate limiter:

- Default: 100 requests per minute per IP
- Returns `429 Too Many Requests` when limit exceeded
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Circuit Breaker

Protects against cascading failures:

| State     | Description                                 |
| --------- | ------------------------------------------- |
| CLOSED    | Normal operation, requests flow through     |
| OPEN      | Backend down, requests rejected immediately |
| HALF_OPEN | Testing recovery, limited requests allowed  |

Configuration:

- **Failure Threshold**: 5 failures to open circuit
- **Reset Timeout**: 30 seconds before testing recovery
- **Success Threshold**: 2 successes to close circuit

## Metrics

Prometheus-compatible metrics available at `/metrics`:

```
axis_proxy_uptime_seconds
axis_proxy_requests_total
axis_proxy_requests_success_total
axis_proxy_requests_failed_total
axis_proxy_response_time_ms{quantile="0.5|0.95|0.99"}
axis_proxy_bytes_in_total
axis_proxy_bytes_out_total
axis_proxy_error_rate
axis_proxy_rps
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: axis-proxy
spec:
  template:
    spec:
      containers:
        - name: axis-proxy
          image: axis-proxy:2.0.0
          ports:
            - containerPort: 7777
          livenessProbe:
            httpGet:
              path: /live
              port: 7777
          readinessProbe:
            httpGet:
              path: /ready
              port: 7777
          env:
            - name: AXIS_BACKEND_URL
              value: 'http://axis-backend:3000/api/axis'
```

## File Structure

```
axis-proxy/
├── src/
│   ├── index.ts           # Main entry point
│   ├── config.ts          # Configuration loader
│   ├── translator.ts      # AXIS protocol translator
│   └── middleware/
│       ├── index.ts       # Middleware exports
│       ├── rate-limiter.ts    # Rate limiting
│       ├── circuit-breaker.ts # Circuit breaker
│       ├── metrics.ts     # Prometheus metrics
│       ├── logger.ts      # Structured logging
│       └── cors.ts        # CORS handler
├── package.json
├── tsconfig.json
└── README.md
```

## License

Apache-2.0 © NextEra.One
