/**
 * Migration Commands Index
 *
 * Exports all migration subcommands for the data CLI
 */

import { MigrateStatusCommand } from './status.js';
import { MigrateRollbackCommand } from './rollback.js';
import { MigrateCleanCommand } from './clean.js';
import { MigrateHistoryCommand } from './history.js';
import { MigrateVerifyCommand } from './verify.js';
import { MigrateSquashCommand } from './squash.js';
import { MigrateGenerateCommand } from './generate.js';
import { MigrateTestCommand } from './test.js';
import { MigrateTestCommand as MigrateTestV2Command } from './test-v2.js';

export {
  MigrateStatusCommand,
  MigrateRollbackCommand,
  MigrateCleanCommand,
  MigrateHistoryCommand,
  MigrateVerifyCommand,
  MigrateSquashCommand,
  MigrateGenerateCommand,
  MigrateTestCommand,
  MigrateTestV2Command
};
