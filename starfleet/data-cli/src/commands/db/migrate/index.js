/**
 * Migration Commands Index
 *
 * Exports all migration subcommands for the data CLI
 */

module.exports = {
  MigrateStatusCommand: require('./status'),
  MigrateRollbackCommand: require('./rollback'),
  MigrateCleanCommand: require('./clean'),
  MigrateHistoryCommand: require('./history'),
  MigrateVerifyCommand: require('./verify'),
  MigrateSquashCommand: require('./squash'),
  MigrateGenerateCommand: require('./generate')
};
