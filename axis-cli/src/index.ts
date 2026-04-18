import { Command } from "commander";

import { nestflowDeviceCommand, nestflowIdentityCommand, nestflowQrCommand, nestflowSessionCommand } from "./commands/nestflow";
import { streamCommand } from "./commands/stream";
import { fileCommand } from "./commands/file";
import { sendCommand } from "./commands/send";
import { chainCommand } from "./commands/chain";

const program = new Command();

program
  .name("axis")
  .description("AXIS Protocol CLI - Modular Edition")
  .version("1.0.0");

import { issueNodeCertCommand } from "./commands/issue-node-cert";

program.addCommand(sendCommand);
program.addCommand(chainCommand);
program.addCommand(fileCommand);
program.addCommand(streamCommand);
program.addCommand(issueNodeCertCommand);
program.addCommand(nestflowDeviceCommand);
program.addCommand(nestflowQrCommand);
program.addCommand(nestflowSessionCommand);
program.addCommand(nestflowIdentityCommand);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
