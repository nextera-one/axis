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
