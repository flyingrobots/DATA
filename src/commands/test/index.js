/**
 * Test Commands for data CLI
 */

const CompileCommand = require('./CompileCommand');
const RunCommand = require('./RunCommand');
const DevCycleCommand = require('./DevCycleCommand');
const CoverageCommand = require('./CoverageCommand');
const WatchCommand = require('./WatchCommand');
const ValidateCommand = require('./ValidateCommand');
const GenerateCommand = require('./GenerateCommand');
const GenerateTemplateCommand = require('./GenerateTemplateCommand');
const CacheCommand = require('./CacheCommand');

// CI Commands for automated testing
const CIValidateCommand = require('./ci/CIValidateCommand');
const CIRunCommand = require('./ci/CIRunCommand');
const CICoverageCommand = require('./ci/CICoverageCommand');

module.exports = {
  CompileCommand,
  RunCommand,
  DevCycleCommand,
  CoverageCommand,
  WatchCommand,
  ValidateCommand,
  GenerateCommand,
  GenerateTemplateCommand,
  CacheCommand,
  // CI Commands
  CIValidateCommand,
  CIRunCommand,
  CICoverageCommand
};