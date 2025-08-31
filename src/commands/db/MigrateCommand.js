/**
 * Database Migration Management Command
 */

const Command = require("../../lib/Command");
const CommandRouter = require("../../lib/CommandRouter");
const { z } = require("zod");

/**
 * Migration command that uses router pattern for subcommands
 */
class MigrateCommand extends Command {
  static description = "Database migration management commands";

  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Subcommands handle their own confirmation
    this.router = this.setupRouter();
  }

  /**
   * Setup the command router with all subcommands
   */
  setupRouter() {
    const router = new CommandRouter();

    // Forward router events to this command
    router.on("start", (data) => this.emit("start", data));
    router.on("progress", (data) => this.emit("progress", data));
    router.on("warning", (data) => this.emit("warning", data));
    router.on("error", (data) => this.emit("error", data));
    router.on("success", (data) => this.emit("success", data));
    router.on("complete", (data) => this.emit("complete", data));
    router.on("failed", (data) => this.emit("failed", data));
    router.on("cancelled", (data) => this.emit("cancelled", data));
    router.on("prompt", (data) => this.emit("prompt", data));

    // Pass config and logger to all handlers
    router.config = this.config;
    router.logger = this.logger;

    // Register generate command
    router
      .command("migrate")
      .subcommand("generate")
      .description("Generate migration from schema diff")
      .schema(
        z.object({
          name: z.string().optional().describe("Migration name"),
          sqlDir: z.string().optional().describe("SQL source directory"),
          migrationsDir: z
            .string()
            .optional()
            .describe("Migrations output directory"),
          dryRun: CommandRouter.schemas.dryRun,
          verbose: CommandRouter.schemas.verbose,
        }),
      )
      .examples(
        "data db migrate generate",
        "data db migrate generate --name add-users-table",
        "data db migrate generate --dry-run",
      )
      .handler(require("./migrate/generate"));

    // Register test command
    router
      .command("migrate")
      .subcommand("test")
      .description("Test migration with pgTAP validation")
      .schema(
        z.object({
          migration: z.string().optional().describe('Migration ID or "latest"'),
          testsDir: z.string().optional().describe("Tests directory"),
          verbose: CommandRouter.schemas.verbose,
          coverage: z
            .boolean()
            .default(false)
            .describe("Generate coverage report"),
        }),
      )
      .examples(
        "data db migrate test",
        "data db migrate test --migration latest",
        "data db migrate test --migration 20250829_001 --coverage",
      )
      .handler(require("./migrate/test-v2"));

    // Register promote command
    router
      .command("migrate")
      .subcommand("promote")
      .description("Promote tested migration to production")
      .schema(
        z.object({
          migration: z.string().optional().describe("Migration ID"),
          prod: CommandRouter.schemas.prod,
          force: CommandRouter.schemas.force,
          skipValidation: z
            .boolean()
            .default(false)
            .describe("Skip validation checks"),
        }),
      )
      .examples(
        "data db migrate promote --migration 20250829_001",
        "data db migrate promote --prod --force",
      )
      .handler(require("./migrate/promote"));

    // Register status command
    router
      .command("migrate")
      .subcommand("status")
      .description("Show current migration status")
      .schema(
        z.object({
          detailed: z.boolean().default(false).describe("Show detailed status"),
          prod: CommandRouter.schemas.prod,
          format: z
            .enum(["table", "json", "yaml"])
            .default("table")
            .describe("Output format"),
        }),
      )
      .examples(
        "data db migrate status",
        "data db migrate status --detailed",
        "data db migrate status --prod --format json",
      )
      .handler(require("./migrate/status"));

    // Register rollback command
    router
      .command("migrate")
      .subcommand("rollback")
      .description("Rollback migration to previous state")
      .schema(
        z.object({
          migration: z.string().optional().describe("Migration to rollback"),
          to: z.string().optional().describe("Rollback to specific migration"),
          prod: CommandRouter.schemas.prod,
          force: CommandRouter.schemas.force,
          dryRun: CommandRouter.schemas.dryRun,
        }),
      )
      .examples(
        "data db migrate rollback",
        "data db migrate rollback --to 20250828_003",
        "data db migrate rollback --prod --force",
      )
      .handler(require("./migrate/rollback"));

    // Register clean command
    router
      .command("migrate")
      .subcommand("clean")
      .description("Clean up temporary migration files")
      .schema(
        z.object({
          all: z.boolean().default(false).describe("Clean all temporary files"),
          failed: z
            .boolean()
            .default(false)
            .describe("Clean only failed migrations"),
          older: z
            .number()
            .optional()
            .describe("Clean migrations older than N days"),
          dryRun: CommandRouter.schemas.dryRun,
        }),
      )
      .examples(
        "data db migrate clean",
        "data db migrate clean --all",
        "data db migrate clean --older 30 --dry-run",
      )
      .handler(require("./migrate/clean"));

    // Register history command
    router
      .command("migrate")
      .subcommand("history")
      .description("Show migration history and timeline")
      .schema(
        z.object({
          limit: z
            .number()
            .int()
            .min(1)
            .default(10)
            .describe("Number of entries to show"),
          from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
          to: z.string().optional().describe("End date (YYYY-MM-DD)"),
          prod: CommandRouter.schemas.prod,
          format: z
            .enum(["table", "json", "timeline"])
            .default("table")
            .describe("Output format"),
        }),
      )
      .examples(
        "data db migrate history",
        "data db migrate history --limit 20",
        "data db migrate history --from 2025-01-01 --format timeline",
      )
      .handler(require("./migrate/history"));

    // Register verify command
    router
      .command("migrate")
      .subcommand("verify")
      .description("Verify migration integrity")
      .schema(
        z.object({
          migration: z.string().optional().describe("Migration to verify"),
          all: z.boolean().default(false).describe("Verify all migrations"),
          checksums: z.boolean().default(true).describe("Verify checksums"),
          prod: CommandRouter.schemas.prod,
        }),
      )
      .examples(
        "data db migrate verify",
        "data db migrate verify --migration 20250829_001",
        "data db migrate verify --all --prod",
      )
      .handler(require("./migrate/verify"));

    // Register squash command
    router
      .command("migrate")
      .subcommand("squash")
      .description("Squash multiple migrations into one")
      .schema(
        z.object({
          from: z.string().optional().describe("Starting migration"),
          to: z.string().optional().describe("Ending migration"),
          name: z.string().optional().describe("Name for squashed migration"),
          keepOriginals: z
            .boolean()
            .default(false)
            .describe("Keep original migration files"),
          dryRun: CommandRouter.schemas.dryRun,
        }),
      )
      .examples(
        "data db migrate squash --from 20250801_001 --to 20250810_005",
        "data db migrate squash --name initial-schema",
        "data db migrate squash --dry-run",
      )
      .handler(require("./migrate/squash"));

    return router;
  }

  /**
   * Execute migration command with router-based subcommand handling
   */
  async performExecute(args = {}) {
    this.emit("start", { isProd: this.isProd });

    try {
      // Get subcommand from arguments
      const subcommand = args._?.[0] || args.subcommand;

      if (!subcommand) {
        this.showHelp();
        this.emit("complete", { action: "help" });
        return;
      }

      // Build the command path for the router
      const commandPath = `migrate/${subcommand}`;

      // Let the router handle it
      this.progress(`Executing migration command: ${subcommand}`);
      const result = await this.router.execute(commandPath, args);

      // Don't emit complete if help was shown
      if (!result?.help) {
        this.emit("complete", { subcommand });
      }

      return result;
    } catch (error) {
      // Check if it's an unknown command
      if (error.message.includes("No handler registered")) {
        const subcommand = args._?.[0] || args.subcommand;
        this.error(`Unknown migration command: ${subcommand}`);
        this.showAvailableCommands();
        this.emit("failed", { error: `Invalid subcommand: ${subcommand}` });
      } else {
        this.error("Migration command failed", error);
        this.emit("failed", { error });
      }
      throw error;
    }
  }

  /**
   * Display help text for migration commands
   */
  showHelp() {
    console.log("Usage: data db migrate <command> [options]");
    console.log("");
    console.log("Database migration management commands");
    console.log("");
    console.log("Commands:");

    // Get all registered routes from the router
    const routes = this.router.getRoutes();
    for (const route of routes) {
      const [, subcommand] = route.path.split("/");
      const description = route.description || "";
      console.log(`  ${subcommand.padEnd(10)} - ${description}`);
    }

    console.log("");
    console.log(
      'Run "data db migrate <command> --help" for command-specific help',
    );
    console.log("");
    console.log("Examples:");
    console.log("  data db migrate generate");
    console.log("  data db migrate test --migration latest");
    console.log("  data db migrate promote --migration 20250829_001");
    console.log("  data db migrate status");
  }

  /**
   * Show available commands when invalid command provided
   */
  showAvailableCommands() {
    console.log("Available migration commands:");

    const routes = this.router.getRoutes();
    for (const route of routes) {
      const [, subcommand] = route.path.split("/");
      console.log(`  ${subcommand}`);
    }

    console.log('\nUse "data db migrate --help" for more information.');
  }
}

module.exports = MigrateCommand;
