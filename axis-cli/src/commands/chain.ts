import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

import { AxisClient, Ed25519Signer } from '@nextera.one/axis-client-sdk';

export const chainCommand = new Command('chain')
  .description('Execute an AXIS intent chain')
  .argument('<chainOrPath>', 'Chain JSON string or path to a chain JSON file')
  .option(
    '-e, --endpoint <url>',
    'Axis base URL (ingress is appended)',
    'http://localhost:3000',
  )
  .option('-a, --actor <id>', 'Actor ID used in frames', 'actor:cli')
  .option('--audience <aud>', 'Audience for the frame', 'axis-core')
  .option('--capsule <jsonOrPath>', 'Inline capsule JSON or path to a capsule file')
  .option('--binary', 'Send the chain using the binary CHAIN.EXEC codec')
  .option('-k, --key <hex>', 'Private key hex for signing (Ed25519)')
  .option('--kid <kid>', 'Key ID to send with signature')
  .action(async (chainOrPath, options) => {
    try {
      const cfg: any = {
        baseUrl: options.endpoint,
        actorId: options.actor,
        audience: options.audience,
        useBinary: Boolean(options.binary),
      };

      if (options.key) {
        if (!options.kid) {
          throw new Error('kid is required when providing a signing key');
        }

        const keyBytes = Uint8Array.from(Buffer.from(String(options.key).trim(), 'hex'));
        cfg.signer = new Ed25519Signer(keyBytes);
        cfg.signerKid = options.kid;
      }

      const client = new AxisClient(cfg);
      const envelope = loadJson(chainOrPath);
      const capsule = options.capsule ? loadJson(String(options.capsule)) : undefined;

      console.log(
        chalk.blue(
          `Sending CHAIN.EXEC${options.binary ? ' (binary)' : ''}...`,
        ),
      );

      const res = await client.chain(envelope, { capsule });

      if (res.ok) {
        console.log(chalk.green('✅ Success'));
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.error(chalk.red(`❌ Error: ${res.error}`));
      }
    } catch (e: any) {
      console.error(chalk.red(`Fatal: ${e.message}`));
    }
  });

function loadJson(input: string): any {
  if (fs.existsSync(input)) {
    return JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  }

  return JSON.parse(input);
}