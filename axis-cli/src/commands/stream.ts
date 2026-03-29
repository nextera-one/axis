import { Command } from 'commander';
import chalk from 'chalk';

import { AxisClient } from '@nextera.one/axis-client-sdk';

export const streamCommand = new Command('stream').description(
  'Stream operations',
);

streamCommand
  .command('tail')
  .argument('<topic>', 'Topic to tail')
  .option(
    '-e, --endpoint <url>',
    'Axis base URL (ingress is appended)',
    'http://localhost:3000',
  )
  .option('-a, --actor <id>', 'Actor ID used in frames', 'actor:cli')
  .action(async (topic, options) => {
    const client = new AxisClient({
      baseUrl: options.endpoint,
      actorId: options.actor,
    });

    console.log(chalk.blue(`Tailing ${topic}... (Ctrl+C to stop)`));

    await client.streamTail(topic, (event: { timestamp: string; type: string; data: unknown }) => {
      console.log(
        `[${event.timestamp}] ${event.type}:`,
        JSON.stringify(event.data),
      );
    });
  });
