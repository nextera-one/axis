import { AxisClient, Ed25519Signer } from '@nextera.one/axis-client-sdk';
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

// ---------------------------------------------------------------------------
// session subcommand group
// ---------------------------------------------------------------------------

const sessionCmd = new Command('session').description(
  'NestFlow session management',
);

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
export { sessionCmd as nestflowSessionCommand };
export { identityCmd as nestflowIdentityCommand };
