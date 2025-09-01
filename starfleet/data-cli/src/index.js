#!/usr/bin/env node

/**
 * data CLI Main Entry Point
 */

import { Command } from 'commander';
import { displayLogo } from './ui/logo.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// Note: Commands are loaded dynamically in their respective action handlers

/**
 * Main CLI function
 */
async function cli(argv) {
  // Check if this is a help request or no arguments (which shows help)
  const isHelpRequest = argv.includes('--help') || argv.includes('-h') || argv.length <= 2;

  // Display logo for interactive sessions and help requests
  if ((process.stdout.isTTY && !process.env.CI) || isHelpRequest) {
    await displayLogo();
  }

  // Configuration now handled via CLI args and env vars

  // Create main command
  const program = new Command();

  // Initialize paths and database credentials in preAction hook
  let paths = null;
  let databaseUrl = null;
  let serviceRoleKey = null;
  let anonKey = null;
  let outputConfig = null;

  program.hook('preAction', async (thisCommand) => {
    const opts = thisCommand.opts();

    // Collect path options
    paths = {
      // Input paths
      sqlDir: opts.sqlDir || process.env.data_SQL_DIR || './sql',
      testsDir: opts.testsDir || process.env.data_TESTS_DIR || './tests',
      functionsDir: opts.functionsDir || process.env.data_FUNCTIONS_DIR || './functions',
      // Output paths
      migrationsDir: opts.migrationsDir || process.env.data_MIGRATIONS_DIR || './migrations',
      buildDir: opts.buildDir || process.env.data_BUILD_DIR || './build',
      reportsDir: opts.reportsDir || process.env.data_REPORTS_DIR || './reports'
    };

    // Get database credentials from environment
    databaseUrl = process.env.DATABASE_URL || process.env.data_DATABASE_URL;
    serviceRoleKey = process.env.data_SERVICE_ROLE_KEY;
    anonKey = process.env.data_ANON_KEY;

    // Initialize OutputConfig
    const { default: OutputConfig } = await import('./lib/OutputConfig.js');
    outputConfig = new OutputConfig(
      opts.config,
      null, // cliSupabaseDir
      paths.migrationsDir,
      paths.testsDir,
      paths.sqlDir,
      paths.functionsDir,
      paths.buildDir,
      null // cliProjectRoot
    );

    // Debug output if requested
    if (process.env.data_DEBUG_PATHS) {
      console.log('data Path Configuration:');
      console.log('Input Paths:', {
        sqlDir: paths.sqlDir,
        testsDir: paths.testsDir,
        functionsDir: paths.functionsDir
      });
      console.log('Output Paths:', {
        migrationsDir: paths.migrationsDir,
        buildDir: paths.buildDir,
        reportsDir: paths.reportsDir
      });
    }
  });

  program
    .name('data')
    .description('⛰️ Advanced Resource Command Hub for PostgreSQL')
    .version(version)
    .option('--prod', 'Target production environment (requires confirmation for write operations)')
    .option('--json', 'Output results as JSON')
    .option('--no-color', 'Disable colored output')
    .option('--config <path>', 'Path to configuration file (default: .datarc.json)')
    // Input directories (for reading)
    .option('--sql-dir <path>', 'Directory containing SQL source files')
    .option('--tests-dir <path>', 'Directory containing test files')
    .option('--functions-dir <path>', 'Directory containing function definitions')
    // Output directories (for writing)
    .option('--migrations-dir <path>', 'Directory for migration output')
    .option('--build-dir <path>', 'Directory for build artifacts')
    .option('--reports-dir <path>', 'Directory for test reports and coverage');

  // Add init command
  program
    .command('init')
    .description('Initialize a new D.A.T.A. project structure')
    .option('--path <path>', 'Path to initialize project (default: current directory)')
    .action(async (options) => {
      const { default: InitCommand } = await import('./commands/InitCommand.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new InitCommand({
        path: options.path || process.cwd()
      });
      const reporter = new CliReporter(program.opts().json);
      reporter.attach(command);

      try {
        await command.execute();
      } catch (error) {
        if (!program.opts().json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  // Add database commands
  const db = program.command('db').description('Database operations');

  db.command('reset')
    .description('Reset the local database')
    .action(async () => {
      const parentOpts = program.opts();
      const { default: ResetCommand } = await import('./commands/db/ResetCommand.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new ResetCommand(
        databaseUrl,
        serviceRoleKey,
        anonKey,
        null, // logger will be added by CliReporter
        parentOpts.prod
      );
      // ResetCommand needs access to outputConfig for supabase directory
      command.outputConfig = outputConfig;
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute();
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  db.command('query <sql>')
    .description('Run an SQL query')
    .option('-f, --file', 'Treat input as file path instead of SQL')
    .action(async (sql, options) => {
      const parentOpts = program.opts();
      const { QueryCommand } = await import('./commands/db/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new QueryCommand(
        databaseUrl,
        serviceRoleKey,
        anonKey,
        null, // logger will be added by CliReporter
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(sql, options.file);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  db.command('compile')
    .description('Compile SQL sources into migration with optional functions deployment')
    .option('--deploy-functions', 'Deploy Edge Functions after successful compilation')
    .option('--functions [names...]', 'Specific functions to deploy (comma-separated)')
    .option('--skip-import-map', 'Skip using import map in production function deployment')
    .option('--debug-functions', 'Enable debug output for function deployment')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { CompileCommand } = await import('./commands/db/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new CompileCommand(paths.sqlDir, paths.migrationsDir, null, parentOpts.prod);
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      // Prepare compile options with functions deployment
      const compileOptions = {
        deployFunctions: options.deployFunctions,
        functionsToDeploy: options.functions || null,
        skipImportMap: options.skipImportMap,
        debug: options.debugFunctions
      };

      try {
        await command.execute(compileOptions);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  // Add migrate subcommands
  const migrate = db.command('migrate').description('Database migration management');

  migrate
    .command('generate')
    .description('Generate migration from schema diff')
    .option('--name <name>', 'Migration name (required)')
    .option('--skip-compile', 'Skip source compilation step')
    .option('--dry-run', 'Show diff without saving migration')
    .option('--current-db <url>', 'Current database URL (defaults to local)')
    .option('--desired-db <url>', 'Desired database URL (defaults to compiled SQL)')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { default: MigrateGenerateCommand } = await import('./commands/db/migrate/generate.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new MigrateGenerateCommand(
        null, // config will use default
        null, // logger will be added by CliReporter
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        // Convert commander options to args array for our command
        const args = [];
        if (options.name) {
          args.push('--name', options.name);
        }
        if (options.skipCompile) {
          args.push('--skip-compile');
        }
        if (options.dryRun) {
          args.push('--dry-run');
        }
        if (options.currentDb) {
          args.push('--current-db', options.currentDb);
        }
        if (options.desiredDb) {
          args.push('--desired-db', options.desiredDb);
        }

        await command.execute(args);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  migrate
    .command('promote')
    .description('Promote tested migration to production')
    .option('-m, --migration <name>', 'Migration to promote', 'current')
    .option('--no-git', 'Skip Git staging')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { default: MigratePromoteCommand } = await import('./commands/db/migrate/promote.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new MigratePromoteCommand(
        null, // config will use default
        null, // logger will be added by CliReporter
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(options);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });
  // Add functions commands
  const functions = program
    .command('functions')
    .alias('fn')
    .description('Edge Functions deployment and management');

  functions
    .command('deploy [functions...]')
    .description('Deploy Edge Functions to Supabase')
    .option('--no-verify-jwt', 'Skip JWT verification during deployment')
    .option('--debug', 'Enable debug output')
    .option('--skip-import-map', 'Skip using import map in production')
    .action(async (functionNames, options) => {
      const parentOpts = program.opts();
      const { DeployCommand } = await import('./commands/functions/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new DeployCommand(paths.functionsDir, null, parentOpts.prod);
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(functionNames, options);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  functions
    .command('validate [functions...]')
    .description('Validate Edge Functions without deploying')
    .action(async (functionNames, _options) => {
      const parentOpts = program.opts();
      const { ValidateCommand } = await import('./commands/functions/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new ValidateCommand(paths.testsDir, paths.reportsDir, null, parentOpts.prod);
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(functionNames);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  functions
    .command('status [functions...]')
    .description('Show Edge Functions deployment status')
    .action(async (functionNames, _options) => {
      const parentOpts = program.opts();
      const { StatusCommand } = await import('./commands/functions/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new StatusCommand(paths.functionsDir, null, parentOpts.prod);
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(functionNames);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  // Add test commands
  const test = program.command('test').description('Database and application testing');

  test
    .command('compile')
    .description('Compile tests for execution')
    .action(async () => {
      const parentOpts = program.opts();
      const { CompileCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new CompileCommand(
        paths.testsDir,
        paths.migrationsDir,
        null,
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute();
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  test
    .command('run')
    .description('Run compiled tests')
    .option('--pattern <pattern>', 'Pattern to match test function names')
    .option('--suite <suite>', 'Run only tests in this suite')
    .option('--tag <tag>', 'Run only tests with this tag')
    .option('--timeout <ms>', 'Test timeout in milliseconds', '30000')
    .option('--verbose', 'Verbose output')
    .option('--format <format>', 'Output format (console, junit, json)', 'console')
    .option('--output <file>', 'Output file for junit/json formats')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { RunCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new RunCommand(
        databaseUrl,
        serviceRoleKey,
        paths.testsDir,
        paths.reportsDir,
        null,
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        const results = await command.execute(options);

        // Set proper exit code based on test results
        if (results && command.getExitCode) {
          const exitCode = command.getExitCode(results);
          if (exitCode !== 0 && !parentOpts.json) {
            process.exit(exitCode);
          }
        }
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  test
    .command('dev-cycle')
    .description('Run full development cycle: compile → reset → test')
    .option('--pattern <pattern>', 'Pattern to match test function names')
    .option('--suite <suite>', 'Run only tests in this suite')
    .option('--tag <tag>', 'Run only tests with this tag')
    .option('--format <format>', 'Output format (console, junit, json)', 'console')
    .option('--output <file>', 'Output file for junit/json formats')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { default: DevCycleCommand } = await import('./commands/test/DevCycleCommand.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new DevCycleCommand(
        databaseUrl,
        serviceRoleKey,
        paths.testsDir,
        paths.migrationsDir,
        null,
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        const results = await command.execute(options);

        // Set proper exit code based on test results
        if (results && command.getExitCode) {
          const exitCode = command.getExitCode(results);
          if (exitCode !== 0 && !parentOpts.json) {
            process.exit(exitCode);
          }
        }
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  test
    .command('coverage')
    .description('Generate test coverage reports')
    .option('--format <format>', 'Output format (html, json, lcov)', 'html')
    .option('--output <dir>', 'Output directory', 'coverage')
    .option('--enforce', 'Enforce coverage thresholds (exits with code 1 if below threshold)')
    .option('--min-coverage <percent>', 'Minimum overall coverage percentage', '80')
    .option('--min-rpc-coverage <percent>', 'Minimum RPC function coverage percentage', '75')
    .option('--min-rls-coverage <percent>', 'Minimum RLS policy coverage percentage', '70')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { CoverageCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new CoverageCommand(
        databaseUrl,
        serviceRoleKey,
        paths.testsDir,
        paths.reportsDir,
        null,
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(options);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  test
    .command('watch')
    .description('Watch for changes and re-run tests')
    .option('--pattern <pattern>', 'Pattern to match test files')
    .option('--ignore <pattern>', 'Pattern to ignore files')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { WatchCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new WatchCommand(
        databaseUrl,
        serviceRoleKey,
        paths.testsDir,
        paths.migrationsDir,
        null,
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(options);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  test
    .command('validate')
    .description('Validate test configuration and setup')
    .option('--fix', 'Attempt to fix validation issues')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { ValidateCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new ValidateCommand(
        databaseUrl,
        serviceRoleKey,
        paths.testsDir,
        paths.reportsDir,
        null,
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(options);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  test
    .command('generate')
    .description('Generate pgTAP test templates for RPC functions and RLS policies')
    .option('--rpc <name>', 'Generate RPC function test template')
    .option('--rls <name>', 'Generate RLS policy test template')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { GenerateCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      // Determine test type and name from options
      let testType, testName;
      if (options.rpc) {
        testType = 'rpc';
        testName = options.rpc;
      } else if (options.rls) {
        testType = 'rls';
        testName = options.rls;
      } else {
        console.error('Error: Must specify either --rpc <name> or --rls <name>');
        process.exit(1);
      }

      const command = new GenerateCommand(paths.testsDir, paths.reportsDir, null, parentOpts.prod);
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute({ type: testType, name: testName });
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  test
    .command('generate-template')
    .description(
      'Generate pgTAP test templates using TestTemplateGenerator and TestRequirementAnalyzer'
    )
    .option('--migration <file>', 'Migration file to analyze for test requirements')
    .option('--type <type>', 'Test type (rpc, rls, trigger, constraint, function)')
    .option(
      '--name <name>',
      'Name of entity to generate tests for (required if not using --migration)'
    )
    .option('--output <file>', 'Output file path (default: stdout)')
    .option('--schema <schema>', 'Schema name (default: public)')
    .option('--parameters <params>', 'Comma-separated function parameters for RPC tests')
    .option('--return-type <type>', 'Expected return type for functions')
    .option('--description <desc>', 'Description for the test')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { GenerateTemplateCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new GenerateTemplateCommand(
        paths.testsDir,
        paths.reportsDir,
        null,
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(options);
      } catch (error) {
        if (!parentOpts.json) {
          console.error('Command failed:', error.message);
          process.exit(1);
        }
      }
    });

  // CI Commands - Optimized for continuous integration
  test
    .command('ci-validate')
    .description('CI-optimized test validation with machine-readable output')
    .option('--output <file>', 'Output file for validation results (JSON format)')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { CIValidateCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new CIValidateCommand(
        databaseUrl,
        serviceRoleKey,
        paths.testsDir,
        paths.reportsDir,
        null,
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(options);
      } catch (error) {
        // CI commands always exit with proper codes
        console.error('CI command failed:', error.message);
        process.exit(1);
      }
    });

  test
    .command('ci-run')
    .description('CI-optimized test execution with JUnit/JSON output')
    .option('--pattern <pattern>', 'Pattern to match test function names')
    .option('--suite <suite>', 'Run only tests in this suite')
    .option('--format <format>', 'Output format (junit, json)', 'junit')
    .option('--output <file>', 'Output file for test results')
    .option('--detailed', 'Include detailed results in JSON output', true)
    .action(async (options) => {
      const parentOpts = program.opts();
      const { CIRunCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new CIRunCommand(
        databaseUrl,
        serviceRoleKey,
        paths.testsDir,
        paths.reportsDir,
        null,
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        const results = await command.execute(options);

        // CI commands handle their own exit codes
        const exitCode = command.getExitCode(results);
        process.exit(exitCode);
      } catch (error) {
        console.error('CI command failed:', error.message);
        process.exit(1);
      }
    });

  test
    .command('ci-coverage')
    .description('CI-optimized coverage analysis with enforcement')
    .option('--enforce', 'Enforce coverage thresholds (default: false)', false)
    .option('--min-coverage <percent>', 'Minimum overall coverage percentage', '80')
    .option('--min-rpc-coverage <percent>', 'Minimum RPC function coverage percentage', '75')
    .option('--min-rls-coverage <percent>', 'Minimum RLS policy coverage percentage', '70')
    .option('--format <format>', 'Output format (json)', 'json')
    .option('--output <file>', 'Output file prefix for coverage reports')
    .action(async (options) => {
      const parentOpts = program.opts();
      const { CICoverageCommand } = await import('./commands/test/index.js');
      const { default: CliReporter } = await import('./reporters/CliReporter.js');

      const command = new CICoverageCommand(
        null, // config - uses default
        null, // logger - added by reporter
        parentOpts.prod
      );
      const reporter = new CliReporter(parentOpts.json);
      reporter.attach(command);

      try {
        await command.execute(options);
        // CI coverage command handles its own exit codes via process.exitCode
      } catch (error) {
        console.error('CI command failed:', error.message);
        process.exit(1);
      }
    });

  // TODO: Add maintenance commands when implemented
  // const maintenance = program
  //   .command('maintenance')
  //   .alias('maint')
  //   .description('Maintenance mode management');

  // TODO: Add status command when implemented
  // program
  //   .command('status')
  //   .description('Show comprehensive system status')
  //   .action(async (options) => {
  //     const parentOpts = program.opts();
  //     await statusCommand.execute({ ...options, ...parentOpts, config });
  //   });

  // Parse arguments
  await program.parseAsync(argv);

  // Show help if no command provided
  if (argv.length === 2) {
    program.help();
  }
}

export { cli };
export default cli;

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli(process.argv).catch(console.error);
}
