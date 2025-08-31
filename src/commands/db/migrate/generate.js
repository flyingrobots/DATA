const Command = require("../../../lib/Command");
const MigrationMetadata = require("../../../lib/MigrationMetadata");
const fs = require("fs").promises;
const path = require("path");

/**
 * MigrateGenerateCommand - Generate migration from schema diff
 *
 * Creates a new migration by comparing current database state with desired state
 * from compiled source SQL files. Uses DiffEngine for schema analysis.
 *
 * Options:
 * --name <name>         Migration name (required)
 * --skip-compile        Skip source compilation step
 * --dry-run             Show diff without saving migration
 * --current-db <url>    Current database URL (defaults to local)
 * --desired-db <url>    Desired database URL (defaults to compiled SQL)
 */
class MigrateGenerateCommand extends Command {
  static description = "Generate migration from schema diff";
  static requiresConfirmation = false; // Generation is safe operation

  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Safe in production
  }

  /**
   * Execute the migration generation command
   */
  async performExecute(args) {
    try {
      // Parse command line options
      const options = this.parseOptions(args);

      this.progress("Starting migration generation", {
        migrationName: options.name,
        dryRun: options.dryRun,
        skipCompile: options.skipCompile,
      });

      // Validate required options
      if (!options.name) {
        throw new Error(
          "Migration name is required. Use --name <migration_name>",
        );
      }

      // Generate the migration
      const migration = await this.generateMigration(options.name, options);

      if (options.dryRun) {
        // Dry run - just display the diff
        await this.displayDryRun(migration);
      } else {
        // Save migration to staging directory
        const migrationPath = await this.saveToStaging(migration, options.name);

        this.success("Migration generated successfully", {
          migrationName: options.name,
          path: migrationPath,
          hasDifferences: migration.hasDifferences,
          statementCount: migration.statements.length,
        });
      }

      return migration;
    } catch (error) {
      this.error("Failed to generate migration", error, {
        operation: "generate",
        args: args,
      });
      throw error;
    }
  }

  /**
   * Generate migration (MVP version - placeholder implementation)
   */
  async generateMigration(name, options) {
    try {
      this.progress("Generating migration (MVP version)");

      // MVP implementation: Create a placeholder migration for testing
      // This will be enhanced later with actual DiffEngine integration
      const placeholder = `
-- Example CREATE TABLE statement
CREATE TABLE IF NOT EXISTS example_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Example INSERT statement  
INSERT INTO example_table (name) VALUES ('test_data');
`;

      this.progress("Generated placeholder migration SQL");

      const migrationSql =
        this.generateMigrationHeader(name, { stats: { filesProcessed: 1 } }) +
        "\n" +
        placeholder;

      return {
        name,
        hasDifferences: true,
        statements: this.parseSqlStatements(placeholder),
        migrationSql,
        metadata: {
          sourceFilesCompiled: 1,
          generationTimeMs: 0,
          generatedAt: new Date(),
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.error("Failed to generate migration", error, {
        migrationName: name,
      });
      throw error;
    }
  }

  /**
   * Save migration to staging directory
   */
  async saveToStaging(migration, name) {
    try {
      // Get staging directory path
      const stagingDir = this.getStagingDirectory();
      const migrationDir = path.join(stagingDir, "current");

      this.progress("Saving migration to staging", {
        migrationName: name,
        stagingDir: migrationDir,
      });

      // Ensure staging directory exists
      await fs.mkdir(migrationDir, { recursive: true });

      // Write migration SQL
      const migrationFile = path.join(migrationDir, "migration.sql");
      await fs.writeFile(migrationFile, migration.migrationSql, "utf8");

      // Create and write metadata
      const migrationId = this.generateMigrationId(name);
      const metadata = MigrationMetadata.createDefault(migrationId, name);

      // Add generation details to metadata
      metadata.generation = {
        generated_at: migration.generatedAt,
        has_differences: migration.hasDifferences,
        statement_count: migration.statements.length,
        source_files_compiled: migration.metadata.sourceFilesCompiled || 0,
        generation_time_ms: migration.metadata.generationTimeMs || 0,
      };

      const metadataHandler = new MigrationMetadata(migrationDir);
      metadataHandler.write(metadata);

      this.progress("Migration saved to staging", {
        migrationFile,
        metadataFile: metadataHandler.metadataFile,
        migrationId,
      });

      return migrationDir;
    } catch (error) {
      this.error("Failed to save migration to staging", error, {
        migrationName: name,
      });
      throw error;
    }
  }

  /**
   * Display dry run results
   */
  async displayDryRun(migration) {
    this.progress("=".repeat(60));
    this.progress(`DRY RUN: Migration "${migration.name}"`);
    this.progress("=".repeat(60));

    if (migration.hasDifferences) {
      this.progress(`Found ${migration.statements.length} schema differences:`);
      this.progress("");
      this.progress(migration.migrationSql);
    } else {
      this.progress("No schema differences detected.");
    }

    this.progress("=".repeat(60));
    this.progress("Dry run complete - no files were created");
  }

  /**
   * Generate migration header with metadata
   */
  generateMigrationHeader(name, compileResult) {
    const timestamp = new Date().toISOString();
    const sourceFiles = compileResult?.stats?.filesProcessed || 0;

    return `-- =========================================================================
-- MIGRATION: ${name} - Generated by data CLI
-- =========================================================================
-- 
-- ⛰️ Generated by data Migration Generator
-- Compiled from modular SQL sources
-- 
-- Generated: ${timestamp}
-- Source Files Compiled: ${sourceFiles}
-- 
-- =========================================================================
`;
  }

  /**
   * Parse SQL statements from compiled SQL
   */
  parseSqlStatements(sql) {
    // Simple parsing - split on semicolons and filter
    return sql
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"))
      .map((stmt) => stmt + ";");
  }

  /**
   * Parse command line options
   */
  parseOptions(args) {
    const options = {
      name: null,
      dryRun: false,
      skipCompile: false,
      currentDb: null,
      desiredDb: null,
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case "--name":
          if (i + 1 >= args.length) {
            throw new Error("--name requires a value");
          }
          options.name = args[++i];
          break;

        case "--dry-run":
          options.dryRun = true;
          break;

        case "--skip-compile":
          options.skipCompile = true;
          break;

        case "--current-db":
          if (i + 1 >= args.length) {
            throw new Error("--current-db requires a value");
          }
          options.currentDb = args[++i];
          break;

        case "--desired-db":
          if (i + 1 >= args.length) {
            throw new Error("--desired-db requires a value");
          }
          options.desiredDb = args[++i];
          break;

        default:
          if (arg.startsWith("--")) {
            throw new Error(`Unknown option: ${arg}`);
          }
          // If no option flag, treat as migration name if not set
          if (!options.name) {
            options.name = arg;
          }
          break;
      }
    }

    return options;
  }

  /**
   * Get current database URL (local Supabase instance)
   */
  getCurrentDbUrl() {
    return (
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@127.0.0.1:54332/postgres"
    );
  }

  /**
   * Get desired database URL (same as current - we'll use compiled SQL)
   */
  getDesiredDbUrl() {
    return this.getCurrentDbUrl();
  }

  /**
   * Get SQL source directory path
   */
  getSqlSourceDir() {
    // Use config paths if available, otherwise default to 'sql' in current directory
    if (this.config && this.config.get) {
      return path.resolve(this.config.get("paths.sql_dir") || "./sql");
    }
    return path.resolve("./sql");
  }

  /**
   * Get staging directory path
   */
  getStagingDirectory() {
    // Use config paths if available, otherwise default to 'migrations-staging' in current directory
    if (this.config && this.config.get) {
      const migrationsDir =
        this.config.get("paths.migrations_dir") || "./migrations";
      return path.resolve(migrationsDir + "-staging");
    }
    return path.resolve("./migrations-staging");
  }

  /**
   * Create database connection object for DiffEngine
   */
  createDbConnection(dbUrl) {
    const url = new URL(dbUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1), // Remove leading slash
      user: url.username,
      password: url.password,
      url: dbUrl,
    };
  }

  /**
   * Sanitize database URL for logging (remove password)
   */
  sanitizeUrl(dbUrl) {
    try {
      const url = new URL(dbUrl);
      return `${url.protocol}//${url.username}:***@${url.host}:${url.port}${url.pathname}`;
    } catch {
      return "invalid-url";
    }
  }

  /**
   * Generate unique migration ID
   */
  generateMigrationId(name) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "")
      .substring(0, 15);
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    return `${timestamp}_${sanitizedName}`;
  }
}

module.exports = MigrateGenerateCommand;
