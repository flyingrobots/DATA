/**
 * Database Commands for data CLI
 */

const ResetCommand = require('./ResetCommand');
const QueryCommand = require('./QueryCommand');
const CompileCommand = require('./CompileCommand');
const MigrateCommand = require('./MigrateCommand');

module.exports = {
  ResetCommand,
  QueryCommand,
  CompileCommand,
  MigrateCommand
};