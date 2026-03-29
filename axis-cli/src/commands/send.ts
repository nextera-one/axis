import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

import { AxisClient, Ed25519Signer } from '@nextera.one/axis-client-sdk';

export const sendCommand = new Command('send')
  .description('Send an arbitrary intent')
  .argument('<intent>', 'Intent name (e.g. system.ping)')
  .argument('[body]', 'JSON body (string)')
  .option(
    '-e, --endpoint <url>',
    'Axis base URL (ingress is appended)',
    'http://localhost:3000',
  )
  .option('-a, --actor <id>', 'Actor ID used in frames', 'actor:cli')
  .option('--audience <aud>', 'Audience for the frame', 'axis-core')
  .option('--exec', 'Send via INTENT.EXEC wrapper (capsule/execNonce)')
  .option('--exec-nonce <nonce>', 'Provide execNonce (defaults to random)')
  .option('--capsule <jsonOrPath>', 'Capsule JSON or path to capsule file')
  .option('-k, --key <hex>', 'Private key hex for signing (Ed25519)')
  .option('--kid <kid>', 'Key ID to send with signature')
  .action(async (intent, bodyStr, options) => {
    try {
      const cfg: any = {
        baseUrl: options.endpoint,
        actorId: options.actor,
        audience: options.audience,
      };

      if (options.key) {
        if (!options.kid) {
          throw new Error('kid is required when providing a signing key');
        }
        const keyHex = String(options.key).trim();
        const keyBytes = Uint8Array.from(Buffer.from(keyHex, 'hex'));
        cfg.signer = new Ed25519Signer(keyBytes);
        cfg.signerKid = options.kid;
      }

      const client = new AxisClient(cfg);

      const body = bodyStr ? JSON.parse(bodyStr) : {};

      let capsule: any;
      if (options.capsule) {
        const candidate = String(options.capsule);
        if (fs.existsSync(candidate)) {
          const raw = fs.readFileSync(path.resolve(candidate), 'utf8');
          capsule = JSON.parse(raw);
        } else {
          capsule = JSON.parse(candidate);
        }
      }

      const useExec = Boolean(options.exec || capsule || options.execNonce);
      console.log(chalk.blue(`Sending ${useExec ? 'INTENT.EXEC' : intent}...`));

      const res = useExec
        ? await client.exec(intent, body, {
            capsule,
            execNonce: options.execNonce,
          })
        : await client.send(intent, body);

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
