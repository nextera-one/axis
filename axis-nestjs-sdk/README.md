# @nextera.one/axis-nestjs-sdk

NestJS-aware adapter for the AXIS Protocol. Provides generic pieces every
NestJS AXIS server needs:

| Export                                        | Purpose                                                       |
| --------------------------------------------- | ------------------------------------------------------------- |
| `AxisMediaTypes`                              | Protocol content-type constants + helpers                     |
| `wasRequestAborted`, `wasResponseClosedEarly` | Node lifecycle helpers                                        |
| `PageResult<T>`                               | Generic paginated response envelope `{ data, count }`         |
| `AxisPageDto`                                 | Reusable TLV DTO for paged reads (`id`, timestamps, `params`) |
| `ObservationStore`                            | CLS-backed per-request `AxisObservation` accessor             |
| `IAxisRequestEngine`                          | Token + interface for the decode/execute engine               |
| `AxisDecodeInterceptor`                       | Nest interceptor running `engine.decode()` pre-handler        |
| `AxisIngressMiddleware`                       | Generic HTTP ingress for `POST /axis`                         |
| `AxisWebSocketGatewayBase`                    | Reusable base class for AXIS WS servers                       |

## Install

```bash
npm install @nextera.one/axis-nestjs-sdk
```

Peer-deps: `@nestjs/common`, `@nextera.one/axis-server-sdk`, `nestjs-cls`,
`rxjs`, and optionally `express`, `ws`, `@nestjs/websockets`.
