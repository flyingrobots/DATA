/**
 * Migration Squash Command
 */

const Command = require("../../../lib/Command");
const fs = require("fs").promises;
const path = require("path");

/**
 * Squash multiple migrations into a single migration file
 */
class MigrateSquashCommand extends Command {
  static description = "Squash multiple migrations";

  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = true; // Potentially destructive operation
  }

  /**
   * Execute migration squashing
   */
  async performExecute(args = {}) {
    this.emit("start");

    try {
      const from = args.from || args.start;
      const to = args.to || args.end || "latest";
      const outputName = args.output || args.o;
      const dryRun = args["dry-run"] || args.n || false;

      if (!from) {
        this.error("Missing required argument: --from <migration>");
        this.emit("failed", { error: "Missing from argument" });
        return;
      }

      this.progress(`Preparing to squash migrations from ${from} to ${to}...`);

      // Find migration files to squash
      const migrationsToSquash = await this.findMigrationsToSquash(from, to);

      if (migrationsToSquash.length === 0) {
        this.warn("No migrations found to squash");
        this.emit("complete", { squashed: 0 });
        return;
      }

      this.progress(`Found ${migrationsToSquash.length} migrations to squash`);

      // Generate squashed migration content
      const squashedContent =
        await this.generateSquashedMigration(migrationsToSquash);

      // Create output filename
      const outputFilename =
        outputName || this.generateSquashedFilename(migrationsToSquash);

      if (dryRun) {
        this.displayDryRunResults(
          migrationsToSquash,
          outputFilename,
          squashedContent,
        );
        this.emit("complete", {
          dryRun: true,
          migrations: migrationsToSquash.length,
        });
        return;
      }

      // Confirm squash operation
      const confirmed = await this.confirmSquashOperation(
        migrationsToSquash,
        outputFilename,
      );
      if (!confirmed) {
        this.success("Squash operation cancelled");
        this.emit("cancelled");
        return;
      }

      // Perform the squash
      await this.performSquash(
        migrationsToSquash,
        outputFilename,
        squashedContent,
      );

      this.success(
        `Successfully squashed ${migrationsToSquash.length} migrations into ${outputFilename}`,
      );
      this.emit("complete", {
        squashed: migrationsToSquash.length,
        output: outputFilename,
      });
    } catch (error) {
      this.error("Migration squash failed", error);
      this.emit("failed", { error });
      throw error;
    }
  }

  /**
   * Find migrations to squash based on from/to parameters
   */
  async findMigrationsToSquash(from, to) {
    try {
      const migrationsDir = path.resolve("supabase/migrations");
      const migrationsExists = await fs
        .access(migrationsDir)
        .then(() => true)
        .catch(() => false);

      if (!migrationsExists) {
        throw new Error("Migrations directory not found");
      }

      const files = await fs.readdir(migrationsDir);
      const migrationFiles = files.filter((f) => f.endsWith(".sql")).sort();

      let startIndex = -1;
      let endIndex = migrationFiles.length - 1;

      // Find start index
      for (let i = 0; i < migrationFiles.length; i++) {
        if (migrationFiles[i].includes(from) || migrationFiles[i] === from) {
          startIndex = i;
          break;
        }
      }

      if (startIndex === -1) {
        throw new Error(`Start migration not found: ${from}`);
      }

      // Find end index
      if (to !== "latest") {
        for (let i = startIndex + 1; i < migrationFiles.length; i++) {
          if (migrationFiles[i].includes(to) || migrationFiles[i] === to) {
            endIndex = i;
            break;
          }
        }
      }

      return migrationFiles.slice(startIndex, endIndex + 1);
    } catch (error) {
      throw new Error(`Failed to find migrations: ${error.message}`);
    }
  }

  /**
   * Generate squashed migration content by combining multiple migrations
   */
  async generateSquashedMigration(migrationFiles) {
    const migrationsDir = path.resolve("supabase/migrations");
    const squashedParts = [];

    // Header
    squashedParts.push("-- Squashed Migration");
    squashedParts.push(`-- Generated: ${new Date().toISOString()}`);
    squashedParts.push(`-- Combines ${migrationFiles.length} migrations:`);

    migrationFiles.forEach((file) => {
      squashedParts.push(`--   - ${file}`);
    });

    squashedParts.push("");
    squashedParts.push("BEGIN;");
    squashedParts.push("");

    // Combine migration contents
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const content = await fs.readFile(filePath, "utf8");

      squashedParts.push(`-- === ${file} ===`);

      // Clean up content (remove individual transactions)
      const cleanedContent = content
        .replace(/^\s*BEGIN\s*;?\s*$/gim, "")
        .replace(/^\s*COMMIT\s*;?\s*$/gim, "")
        .trim();

      if (cleanedContent) {
        squashedParts.push(cleanedContent);
        squashedParts.push("");
      }
    }

    squashedParts.push("COMMIT;");

    return squashedParts.join("\n");
  }

  /**
   * Generate filename for squashed migration
   */
  generateSquashedFilename(migrationFiles) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "")
      .slice(0, 14);

    const firstMigration = migrationFiles[0]
      .replace(/^\d{14}_/, "")
      .replace(/\.sql$/, "");
    const lastMigration = migrationFiles[migrationFiles.length - 1]
      .replace(/^\d{14}_/, "")
      .replace(/\.sql$/, "");

    if (migrationFiles.length === 2) {
      return `${timestamp}_squash_${firstMigration}_and_${lastMigration}.sql`;
    } else {
      return `${timestamp}_squash_${firstMigration}_to_${lastMigration}.sql`;
    }
  }

  /**
   * Display dry run results
   */
  displayDryRunResults(migrations, outputFilename, content) {
    console.log("\n🧪 Dry Run - Migration Squash Preview");
    console.log("══════════════════════════════════════\n");

    console.log(`Migrations to squash (${migrations.length}):`);
    migrations.forEach((migration, index) => {
      console.log(`  ${index + 1}. ${migration}`);
    });
    console.log("");

    console.log(`Output file: ${outputFilename}`);
    console.log(`Content size: ${content.length} characters`);
    console.log("");

    console.log("Preview (first 20 lines):");
    console.log("─".repeat(50));
    const lines = content.split("\n");
    lines.slice(0, 20).forEach((line) => {
      console.log(line);
    });

    if (lines.length > 20) {
      console.log(`... (${lines.length - 20} more lines)`);
    }

    console.log("─".repeat(50));
    console.log("\n✨ This was a dry run - no files were modified");
    console.log("Run without --dry-run to perform the actual squash");
    console.log("");
  }

  /**
   * Confirm squash operation
   */
  async confirmSquashOperation(migrations, outputFilename) {
    console.log("\n⚠️  MIGRATION SQUASH CONFIRMATION");
    console.log("═════════════════════════════════\n");

    console.log(`Migrations to squash: ${migrations.length}`);
    migrations.forEach((migration, index) => {
      console.log(`  ${index + 1}. ${migration}`);
    });
    console.log("");

    console.log(`Output file: ${outputFilename}`);
    console.log("");

    console.log("⚠️  WARNING: This operation will:");
    console.log("   • Create a new squashed migration file");
    console.log("   • Archive the original migration files");
    console.log("   • Update migration history");
    console.log("");

    console.log("⚠️  Make sure you have backed up your migrations!");
    console.log("");

    return await this.confirm("Proceed with migration squash?", false);
  }

  /**
   * Perform the actual squash operation
   */
  async performSquash(migrations, outputFilename, content) {
    const migrationsDir = path.resolve("supabase/migrations");
    const archiveDir = path.resolve("supabase/.migration_archive");

    // Create archive directory
    await fs.mkdir(archiveDir, { recursive: true });

    // Write squashed migration file
    const outputPath = path.join(migrationsDir, outputFilename);
    await fs.writeFile(outputPath, content, "utf8");
    this.progress(`Created squashed migration: ${outputFilename}`);

    // Archive original migrations
    await Promise.all(
      migrations.map(async (migration) => {
        const sourcePath = path.join(migrationsDir, migration);
        const archivePath = path.join(archiveDir, migration);

        // Move to archive
        await fs.rename(sourcePath, archivePath);
        this.progress(`Archived: ${migration}`);
      }),
    );

    // Update migration history
    await this.updateMigrationHistory(migrations, outputFilename);

    this.progress("Migration squash completed successfully");
  }

  /**
   * Update migration history with squash operation
   */
  async updateMigrationHistory(migrations, outputFilename) {
    try {
      const historyFile = path.resolve("supabase/.migration_history.json");
      let history = [];

      const historyExists = await fs
        .access(historyFile)
        .then(() => true)
        .catch(() => false);
      if (historyExists) {
        const historyContent = await fs.readFile(historyFile, "utf8");
        history = JSON.parse(historyContent);
      }

      // Add squash record
      history.push({
        action: "squash",
        migration: outputFilename,
        squashedMigrations: migrations,
        timestamp: new Date().toISOString(),
        status: "completed",
      });

      await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
      this.progress("Updated migration history");
    } catch (error) {
      this.warn("Could not update migration history", { error: error.message });
    }
  }
}

module.exports = MigrateSquashCommand;
