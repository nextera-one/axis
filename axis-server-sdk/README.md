# @nextera.one/axis-server-sdk

Server-side SDK for the AXIS protocol.

This package contains the Nest-friendly server runtime pieces plus the shared AXIS binary protocol utilities used by both client and server implementations.

## Installation

```bash
npm install @nextera.one/axis-server-sdk
```

Peer dependencies:

- `@nestjs/common`
- `@nestjs/config`
- `reflect-metadata`

## Release Surface

The `1.3.0` release folds the backend server runtime namespaces that previously lived in temporary internal package shells into this published package.

Added grouped runtime namespaces:

- `core`
- `crypto`
- `decorators`
- `engine`
- `loom`
- `schemas`
- `security`
- `sensors`
- `utils`

It also exposes the `axis-generate-keys` CLI through the package `bin` entry for local key generation workflows.

## What It Exposes

Root exports are split into two groups:

- Server runtime helpers: `@Handler`, `@Intent`, `IntentRouter`, handler interfaces, sensor interfaces.
- Shared protocol primitives: binary frame codecs, TLV/varint/constants, binary signature helpers, codec utilities, packet types.

You can also import the grouped namespaces directly from the package root:

```ts
import { core, crypto, engine, sensors } from '@nextera.one/axis-server-sdk';
```

## Shared Core API

The canonical cross-SDK protocol layer is the `./core` subpath:

```ts
import {
  AXIS_MAGIC,
  TLV_AUD,
  TLV_REALM,
  AxisBinaryFrame,
  encodeFrame,
  decodeFrame,
  getSignTarget,
  signFrame,
  verifyFrameSignature,
} from '@nextera.one/axis-server-sdk/core';
```

Notes:

- `TLV_AUD` is the canonical name for tag `8`.
- `TLV_REALM` remains available as a compatibility alias.
- `AxisBinaryFrame` is the explicit low-level binary frame type.
- The server `./core` surface is additive, but shared protocol constants and wire-format helpers are kept aligned with the client SDK.
- `AxisFrameZ` is available from the server package as a server-side validation helper, not as part of the shared minimum core contract.

## Decorator Example

```ts
import {
  Handler,
  Intent,
  IntentRouter,
  AxisEffect,
} from '@nextera.one/axis-server-sdk';
import type { AxisBinaryFrame } from '@nextera.one/axis-server-sdk/core';

@Handler('system')
export class SystemHandler {
  constructor(private readonly router: IntentRouter) {}

  onModuleInit() {
    this.router.registerHandler(this);
  }

  @Intent('ping', { frame: true })
  async ping(frame: AxisBinaryFrame): Promise<AxisEffect> {
    return {
      ok: true,
      effect: 'PONG',
      body: frame.body,
    };
  }
}
```

## Versioning

The server SDK may include additional server-only exports beyond the shared `./core` surface. For code intended to work across both client and server SDKs, prefer importing protocol primitives from `./core`.
