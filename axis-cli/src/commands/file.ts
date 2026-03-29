import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';

import { AxisClient, ProgressInfo } from '@nextera.one/axis-client-sdk';

export const fileCommand = new Command('file').description('File operations');

fileCommand
  .command('upload')
  .argument('<file>', 'Path to file')
  .option(
    '-e, --endpoint <url>',
    'Axis base URL (ingress is appended)',
    'http://localhost:3000',
  )
  .option('-a, --actor <id>', 'Actor ID used in frames', 'actor:cli')
  .action(async (filePath, options) => {
    try {
      const client = new AxisClient({
        baseUrl: options.endpoint,
        actorId: options.actor,
      });

      console.log(chalk.blue(`Uploading ${filePath}...`));

      const result = await client.uploadFile(filePath, {
        onProgress: (p: ProgressInfo) => {
          process.stdout.write(`\r${p.phase}: ${p.percent}%`);
        },
      });

      console.log('\n');
      console.log(chalk.green('✅ Upload Complete'));
      console.log(`File ID: ${result.fileId}`);
      console.log(`Hash: ${result.hash}`);
    } catch (e: any) {
      console.error(chalk.red(`\nUpload Failed: ${e.message}`));
    }
  });

fileCommand
  .command('status')
  .argument('<fileId>', 'File ID')
  .option(
    '-e, --endpoint <url>',
    'Axis base URL (ingress is appended)',
    'http://localhost:3000',
  )
  .option('-a, --actor <id>', 'Actor ID used in frames', 'actor:cli')
  .action(async (fileId, options) => {
    // Implement status using client.send('file.status')
    const client = new AxisClient({
      baseUrl: options.endpoint,
      actorId: options.actor,
    });

    const res = await client.send('file.status', { fileId });
    if (res.ok) {
      console.log(JSON.stringify(res.data, null, 2));
    } else {
      console.error(chalk.red(`Error: ${res.error}`));
    }
  });
