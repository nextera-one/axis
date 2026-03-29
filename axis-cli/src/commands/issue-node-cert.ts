import { webcrypto } from 'node:crypto';
import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

// Polyfill for Ed25519 key generation if SDK doesn't export generic keygen
// or use SDK's internal tools if available.
// Since we don't have direct keygen in exports (checked index.ts), we'll use node crypto.

export const issueNodeCertCommand = new Command('issue-node-cert')
  .description('Issue a node identity certificate')
  .option('-o, --out <dir>', 'Output directory', '.')
  .action(async (options) => {
    try {
      console.log(chalk.blue('Generating Node Identity...'));

      const keyPair = (await webcrypto.subtle.generateKey(
        {
          name: 'Ed25519',
        },
        true,
        ['sign', 'verify'],
      )) as unknown as CryptoKeyPair;

      const { privateKey, publicKey } = keyPair;

      const privBytes = new Uint8Array(
        await webcrypto.subtle.exportKey('pkcs8', privateKey),
      );
      const pubBytes = new Uint8Array(
        await webcrypto.subtle.exportKey('spki', publicKey),
      );

      const identity = {
        nodeId: `node_${Buffer.from(pubBytes).subarray(0, 8).toString('hex')}`,
        created: new Date().toISOString(),
        publicKey: Buffer.from(pubBytes).toString('base64'),
        // In real impl, we might want raw private key bytes,
        // but standard crypto export is fine for now.
      };

      const outDir = path.resolve(options.out);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const keyPath = path.join(outDir, 'node-identity.json');
      const certPath = path.join(outDir, 'node-identity.key'); // The private key raw/pem

      fs.writeFileSync(keyPath, JSON.stringify(identity, null, 2));
      fs.writeFileSync(certPath, Buffer.from(privBytes)); // Saving binary private key

      console.log(chalk.green('✅ Node Identity Issued'));
      console.log(`Node ID: ${identity.nodeId}`);
      console.log(`Identity: ${keyPath}`);
      console.log(`Private Key: ${certPath}`);
    } catch (e: any) {
      console.error(chalk.red(`Error: ${e.message}`));
    }
  });
