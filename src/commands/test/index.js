/**
 * Test Commands for data CLI
 */

import CompileCommand from './CompileCommand.js';
import RunCommand from './RunCommand.js';
import DevCycleCommand from './DevCycleCommand.js';
import CoverageCommand from './CoverageCommand.js';
import WatchCommand from './WatchCommand.js';
import ValidateCommand from './ValidateCommand.js';
import GenerateCommand from './GenerateCommand.js';
import GenerateTemplateCommand from './GenerateTemplateCommand.js';
import CacheCommand from './CacheCommand.js';

// CI Commands for automated testing
import CIValidateCommand from './ci/CIValidateCommand.js';
import CIRunCommand from './ci/CIRunCommand.js';
import CICoverageCommand from './ci/CICoverageCommand.js';

export {
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