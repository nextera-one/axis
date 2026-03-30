# AXIS CLI

The official Command Line Interface for the AXIS Protocol. Issued by **NextEra.One**.

## Features

- **Intent Execution**: Send intents to AXIS nodes with Ed25519 signatures.
- **Identity Management**: Issue node certificates and manage actor identities.
- **Stream Support**: Pulse data streams over the AXIS protocol.
- **File Operations**: Verifiable file uploads and downloads.
- **Network Discovery**: Inspect node health and protocol specs.

## Installation

```bash
# Clone the repository
git clone https://github.com/nextera-one/axis-cli.git
cd axis-cli

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

```bash
# General help
axis --help

# Send a ping intent
axis send public.ping '{"hello": "world"}'

# Issue a new node identity
axis issue-node-cert --out ./certs

# Stream sensor data
axis stream sensors.temp

# NestFlow device management
axis device list --endpoint http://localhost:7777 --actor 00000000000000000000000000000001
axis device promote dev_web_abc123 --label "My Laptop"
axis device rename dev_web_abc123 "Work Chrome"
axis device revoke dev_web_abc123 --reason "lost device"

# NestFlow session management
axis session refresh --reason "keepalive"
axis session logout --reason "manual"

# NestFlow backend QR flow
axis qr challenge --origin https://app.example.com
axis qr browser-proof chlg_123 nonce_123 --key <browser_seed_hex>
axis qr attach-key chlg_123 --browser-public-key <spki_b64url> --proof-signature <sig_b64url> --trust-device
axis qr approve chlg_123 -a actor_123 -k <mobile_seed_hex> --mobile-device-uid dev_mobile_01 --browser-public-key <spki_b64url> --nonce nonce_123 --tickauth-challenge-uid tick_123 --expires-at 1760000000000 --scope axis.auth.*,axis.files.*
axis qr verify chlg_123 --browser-public-key <spki_b64url>
axis qr reject chlg_123 -a actor_123
```

## Configuration

| Environment Variable | Description      | Default                 |
| -------------------- | ---------------- | ----------------------- |
| `AXIS_ENDPOINT`      | AXIS Node URL    | `http://localhost:3000` |
| `AXIS_ACTOR_ID`      | Default Actor ID | `actor:cli`             |
| `AXIS_KEY`           | Private key hex  | -                       |

## Architecture

The CLI uses the `@nextera.one/axis-client-sdk` for binary frame construction and transport logic. It is designed for high-performance terminal interactions with AXIS-compliant infrastructure.

## License

Apache-2.0 © NextEra.One
