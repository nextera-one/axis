import {
  AxisClient,
  AxisQrAuthIntents,
  buildAxisQrApproveRequest,
  buildAxisQrAttachKeyRequest,
  buildAxisQrChallengeRequest,
  buildAxisQrRejectRequest,
  buildAxisQrVerifyRequest,
  buildBrowserProofMessage,
  buildQrApprovalPayload,
  ed25519PublicKeyToSpkiBase64Url,
  Ed25519Signer,
  signQrApprovalPayload,
} from '@nextera.one/axis-client-sdk';
import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadKeyPair(keyPath: string): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const raw = fs.readFileSync(path.resolve(keyPath), 'utf8');
  const json = JSON.parse(raw);
  return {
    privateKey: Uint8Array.from(Buffer.from(json.privateKey, 'hex')),
    publicKey: Uint8Array.from(Buffer.from(json.publicKey, 'hex')),
  };
}

function makeClient(
  endpoint: string,
  actorId: string,
  keyHex?: string,
  kid?: string,
) {
  const cfg: any = {
    baseUrl: endpoint,
    actorId,
    audience: 'axis-core',
  };
  if (keyHex && kid) {
    cfg.signer = new Ed25519Signer(Uint8Array.from(Buffer.from(keyHex, 'hex')));
    cfg.signerKid = kid;
  }
  return new AxisClient(cfg);
}

// ---------------------------------------------------------------------------
// device subcommand group
// ---------------------------------------------------------------------------

const deviceCmd = new Command('device').description(
  'NestFlow device management',
);

deviceCmd
  .command('list')
  .description('List devices for the current identity')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .option('-k, --key <hex>', 'Private key hex')
  .option('--kid <kid>', 'Key ID')
  .action(async (opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor, opts.key, opts.kid);
      const res = await client.send('device.list', {});
      if (res.ok) {
        const devices = (res.data as any)?.devices ?? [];
        if (devices.length === 0) {
          console.log(chalk.yellow('No devices found.'));
          return;
        }
        console.log(chalk.blue(`${devices.length} device(s):`));
        for (const d of devices) {
          const trust =
            d.trust_level === 'primary'
              ? chalk.green(d.trust_level)
              : d.trust_level;
          console.log(
            `  ${d.device_uid}  ${d.name ?? '(unnamed)'}  type=${d.type}  trust=${trust}  status=${d.status}`,
          );
        }
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

deviceCmd
  .command('revoke <device_uid>')
  .description('Revoke a device')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .option('-k, --key <hex>', 'Private key hex')
  .option('--kid <kid>', 'Key ID')
  .option('-r, --reason <reason>', 'Revocation reason')
  .action(async (deviceUid, opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor, opts.key, opts.kid);
      const res = await client.send('device.revoke', {
        target_device_uid: deviceUid,
        reason: opts.reason,
      });
      if (res.ok) {
        console.log(chalk.green(`✅ Device ${deviceUid} revoked`));
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

deviceCmd
  .command('promote <device_uid>')
  .description('Promote a device to trusted level')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .option('-k, --key <hex>', 'Private key hex')
  .option('--kid <kid>', 'Key ID')
  .option('-l, --label <label>', 'Optional trusted device label')
  .action(async (deviceUid, opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor, opts.key, opts.kid);
      const res = await client.send('device.trust.promote', {
        target_device_uid: deviceUid,
        label: opts.label,
      });
      if (res.ok) {
        console.log(chalk.green(`✅ Device ${deviceUid} promoted`));
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

deviceCmd
  .command('rename <device_uid> <label>')
  .description('Rename a trusted device')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .option('-k, --key <hex>', 'Private key hex')
  .option('--kid <kid>', 'Key ID')
  .action(async (deviceUid, label, opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor, opts.key, opts.kid);
      const res = await client.send('device.rename', {
        target_device_uid: deviceUid,
        label,
      });
      if (res.ok) {
        console.log(chalk.green(`✅ Device ${deviceUid} renamed`));
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

// ---------------------------------------------------------------------------
// session subcommand group
// ---------------------------------------------------------------------------

const sessionCmd = new Command('session').description(
  'NestFlow session management',
);

const qrCmd = new Command('qr').description('NestFlow QR login flow');

sessionCmd
  .command('logout')
  .description('Terminate the current session')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .option('-k, --key <hex>', 'Private key hex')
  .option('--kid <kid>', 'Key ID')
  .option('-r, --reason <reason>', 'Logout reason')
  .action(async (opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor, opts.key, opts.kid);
      const res = await client.send('session.logout', { reason: opts.reason });
      if (res.ok) {
        console.log(chalk.green('✅ Session terminated'));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

sessionCmd
  .command('refresh')
  .description('Refresh the current session')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .option('-k, --key <hex>', 'Private key hex')
  .option('--kid <kid>', 'Key ID')
  .option('-r, --reason <reason>', 'Refresh reason')
  .action(async (opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor, opts.key, opts.kid);
      const res = await client.send('session.refresh', { reason: opts.reason });
      if (res.ok) {
        console.log(chalk.green('✅ Session refreshed'));
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

qrCmd
  .command('challenge')
  .description('Request a backend QR login challenge')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .option('--origin <origin>', 'Browser origin')
  .option('--ip-address <ip>', 'Client IP address')
  .option('--ttl-seconds <seconds>', 'Challenge TTL in seconds')
  .action(async (opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor);
      const res = await client.send(
        AxisQrAuthIntents.CHALLENGE,
        buildAxisQrChallengeRequest({
          origin: opts.origin,
          ipAddress: opts.ipAddress,
          ttlSeconds: opts.ttlSeconds ? Number(opts.ttlSeconds) : undefined,
        }),
      );
      if (res.ok) {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

qrCmd
  .command('browser-proof <challenge_uid> <nonce>')
  .description(
    'Generate browser proof message, signature, and SPKI public key from an Ed25519 seed',
  )
  .requiredOption(
    '-k, --key <hex>',
    'Browser private key hex (32-byte Ed25519 seed)',
  )
  .action(async (challengeUid, nonce, opts) => {
    try {
      const signer = new Ed25519Signer(
        Uint8Array.from(Buffer.from(opts.key, 'hex')),
      );
      const publicKey = await signer.getPublicKey();
      const signature = await signer.sign(
        buildBrowserProofMessage(challengeUid, nonce),
      );

      console.log(
        JSON.stringify(
          {
            challengeUid,
            nonce,
            browserPublicKey: ed25519PublicKeyToSpkiBase64Url(publicKey),
            browserKeyAlgorithm: 'ed25519',
            browserProofSignature: Buffer.from(signature)
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, ''),
          },
          null,
          2,
        ),
      );
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

qrCmd
  .command('attach-key <challenge_uid>')
  .description(
    'Attach a generated browser public key and proof to a QR challenge',
  )
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .requiredOption(
    '--browser-public-key <b64url>',
    'Browser public key as base64url SPKI',
  )
  .requiredOption(
    '--proof-signature <b64url>',
    'Browser proof signature as base64url',
  )
  .option('--browser-key-algorithm <alg>', 'Browser key algorithm', 'ed25519')
  .option('--trust-device', 'Request trusted device promotion')
  .action(async (challengeUid, opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor);
      const res = await client.send(
        AxisQrAuthIntents.ATTACH_KEY,
        buildAxisQrAttachKeyRequest({
          challengeUid,
          browserPublicKey: opts.browserPublicKey,
          browserKeyAlgorithm: opts.browserKeyAlgorithm,
          browserProofSignature: opts.proofSignature,
          trustDeviceRequested: Boolean(opts.trustDevice),
        }),
      );
      if (res.ok) {
        console.log(chalk.green('✅ Browser key attached'));
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

qrCmd
  .command('approve <challenge_uid>')
  .description(
    'Approve a QR login challenge using the mobile device signing key',
  )
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .requiredOption('-a, --actor <id>', 'Actor ID')
  .requiredOption(
    '-k, --key <hex>',
    'Mobile private key hex (32-byte Ed25519 seed)',
  )
  .requiredOption('--mobile-device-uid <uid>', 'Registered mobile device UID')
  .requiredOption(
    '--browser-public-key <b64url>',
    'Approved browser public key',
  )
  .requiredOption('--nonce <nonce>', 'Challenge nonce')
  .requiredOption('--tickauth-challenge-uid <uid>', 'TickAuth challenge UID')
  .requiredOption(
    '--expires-at <unix_ms>',
    'Challenge expiry time as unix milliseconds',
  )
  .option('--scope <items>', 'Comma-separated scope list')
  .action(async (challengeUid, opts) => {
    try {
      const signer = new Ed25519Signer(
        Uint8Array.from(Buffer.from(opts.key, 'hex')),
      );
      const scope = parseScope(opts.scope);
      const payload = buildQrApprovalPayload({
        challengeUid,
        browserPublicKey: opts.browserPublicKey,
        nonce: opts.nonce,
        tickauthChallengeUid: opts.tickauthChallengeUid,
        expiresAt: Number(opts.expiresAt),
        actorId: opts.actor,
        approvedAt: Date.now(),
        scope,
      });
      const { signedPayload, signature } = await signQrApprovalPayload(
        payload,
        signer,
      );

      const client = makeClient(
        opts.endpoint,
        opts.actor,
        opts.key,
        opts.mobileDeviceUid,
      );
      const res = await client.send(
        AxisQrAuthIntents.APPROVE,
        buildAxisQrApproveRequest({
          challengeUid,
          actorId: opts.actor,
          mobileDeviceUid: opts.mobileDeviceUid,
          signedPayload,
          signature,
          scope,
        }),
      );
      if (res.ok) {
        console.log(chalk.green('✅ QR challenge approved'));
        console.log(
          JSON.stringify(
            { signedPayload, signature, result: res.data },
            null,
            2,
          ),
        );
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

qrCmd
  .command('reject <challenge_uid>')
  .description('Reject a QR login challenge')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .requiredOption('-a, --actor <id>', 'Actor ID')
  .action(async (challengeUid, opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor);
      const res = await client.send(
        AxisQrAuthIntents.REJECT,
        buildAxisQrRejectRequest({
          challengeUid,
          actorId: opts.actor,
        }),
      );
      if (res.ok) {
        console.log(chalk.green('✅ QR challenge rejected'));
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

qrCmd
  .command('verify <challenge_uid>')
  .description('Poll and verify whether a QR challenge has been approved')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .requiredOption(
    '--browser-public-key <b64url>',
    'Browser public key bound to the challenge',
  )
  .action(async (challengeUid, opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor);
      const res = await client.send(
        AxisQrAuthIntents.VERIFY,
        buildAxisQrVerifyRequest({
          challengeUid,
          browserPublicKey: opts.browserPublicKey,
        }),
      );
      if (res.ok) {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

// ---------------------------------------------------------------------------
// identity subcommand group
// ---------------------------------------------------------------------------

const identityCmd = new Command('identity').description(
  'NestFlow identity operations',
);

identityCmd
  .command('lock')
  .description('Lock an identity (emergency freeze)')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .option('-k, --key <hex>', 'Private key hex (primary device)')
  .option('--kid <kid>', 'Key ID')
  .action(async (opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor, opts.key, opts.kid);
      const res = await client.send('identity.lock', {});
      if (res.ok) {
        console.log(chalk.green('✅ Identity locked'));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

identityCmd
  .command('unlock')
  .description('Unlock a previously locked identity')
  .option('-e, --endpoint <url>', 'Axis base URL', 'http://localhost:3000')
  .option('-a, --actor <id>', 'Actor ID', 'actor:cli')
  .option('-k, --key <hex>', 'Private key hex (primary device)')
  .option('--kid <kid>', 'Key ID')
  .action(async (opts) => {
    try {
      const client = makeClient(opts.endpoint, opts.actor, opts.key, opts.kid);
      const res = await client.send('identity.unlock', {});
      if (res.ok) {
        console.log(chalk.green('✅ Identity unlocked'));
      } else {
        console.error(chalk.red(`Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

export { deviceCmd as nestflowDeviceCommand };
export { qrCmd as nestflowQrCommand };
export { sessionCmd as nestflowSessionCommand };
export { identityCmd as nestflowIdentityCommand };

function parseScope(raw?: string): string[] | undefined {
  if (!raw) {
    return undefined;
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
