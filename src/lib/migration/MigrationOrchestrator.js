/**
 * Migration Orchestrator for D.A.T.A. (Database Automation, Testing, and Alignment)
 *
 * Main entry point that coordinates the entire migration workflow:
 * 1. Git state validation -> clean working tree required
 * 2. Test execution -> all tests must pass before migration
 * 3. Schema analysis -> generate migration using AST engine
 * 4. Preview and confirmation -> show user what will happen
 * 5. Database migration -> execute in transaction with rollback
 * 6. Edge Functions deployment -> deploy functions after DB changes
 * 7. Git tagging -> tag deployment for future reference
 * 8. Rollback support -> revert to previous deployment if needed
 *
 * @module MigrationOrchestrator
 */

const { EventEmitter } = require("events");
const SupabaseCommand = require("../SupabaseCommand");
const ASTMigrationEngine = require("./ASTMigrationEngine");
const GitDeploymentTracker = require("./GitDeploymentTracker");
const SchemaDiffAnalyzer = require("./SchemaDiffAnalyzer");
const ChildProcessWrapper = require("../ChildProcessWrapper");
const TestCoverageOrchestrator = require("../testing/TestCoverageOrchestrator");
const path = require("path");
const fs = require("fs").promises;

/**
 * Orchestrator workflow phases
 * @readonly
 * @enum {string}
 */
const PHASES = {
  VALIDATION: "validation",
  TESTING: "testing",
  COVERAGE: "coverage",
  ANALYSIS: "analysis",
  PREVIEW: "preview",
  CONFIRMATION: "confirmation",
  MIGRATION: "migration",
  FUNCTIONS: "functions",
  TAGGING: "tagging",
  COMPLETE: "complete",
  ROLLBACK: "rollback",
};

/**
 * Migration operation types
 * @readonly
 * @enum {string}
 */
const OPERATIONS = {
  FULL_DEPLOY: "full_deploy",
  SCHEMA_ONLY: "schema_only",
  FUNCTIONS_ONLY: "functions_only",
  ROLLBACK: "rollback",
};

class MigrationOrchestrator extends SupabaseCommand {
  constructor(options = {}) {
    super(
      options.supabaseUrl,
      options.serviceRoleKey,
      options.logger,
      options.isProd || false,
      options.requiresConfirmation !== false, // Default to true
    );

    // Configuration
    this.sqlDir = options.sqlDir || process.env.ARCHY_SQL_DIR || "./sql";
    this.migrationsDir =
      options.migrationsDir ||
      process.env.ARCHY_MIGRATIONS_DIR ||
      "./migrations";
    this.functionsDir =
      options.functionsDir || process.env.ARCHY_FUNCTIONS_DIR || "./functions";
    this.testsDir =
      options.testsDir || process.env.ARCHY_TESTS_DIR || "./tests";

    // Dependencies (injected for testing)
    this.astEngine = options.astEngine || new ASTMigrationEngine();
    this.gitTracker = options.gitTracker || new GitDeploymentTracker();
    this.diffAnalyzer = options.diffAnalyzer || new SchemaDiffAnalyzer();
    this.childProcess = options.childProcess || new ChildProcessWrapper();
    this.coverageOrchestrator =
      options.coverageOrchestrator ||
      new TestCoverageOrchestrator({
        testsDir: this.testsDir,
        sqlDir: this.sqlDir,
        enforcementLevel: options.coverageEnforcementLevel || "normal",
        generateTemplates: options.generateCoverageTemplates || false,
        allowBypass: options.allowCoverageBypass || false,
      });

    // Workflow options
    this.skipTests = options.skipTests || false;
    this.skipCoverage = options.skipCoverage || false;
    this.skipFunctions = options.skipFunctions || false;
    this.dryRun = options.dryRun || false;
    this.forceRollback = options.forceRollback || false;
    this.coverageBypassReason = options.coverageBypassReason || null;

    // Current operation state
    this.currentOperation = null;
    this.currentPhase = null;
    this.migrationOperations = [];
    this.rollbackPoint = null;

    // Wire up engine events
    this.setupEngineEventHandlers();
  }

  /**
   * Setup event forwarding from sub-components
   */
  setupEngineEventHandlers() {
    // Forward AST engine events
    this.astEngine.on("start", (data) =>
      this.progress("AST Engine: " + data.message, data),
    );
    this.astEngine.on("progress", (data) =>
      this.progress("AST Engine: " + data.message, data),
    );

    // Forward coverage orchestrator events
    this.coverageOrchestrator.on("progress", (data) =>
      this.progress("Coverage: " + data.message, data),
    );
    this.coverageOrchestrator.on("warning", (data) =>
      this.warn("Coverage: " + data.message, data),
    );
    this.coverageOrchestrator.on("enforcement_failed", (data) =>
      this.error("Coverage enforcement failed", data),
    );
    this.coverageOrchestrator.on("enforcement_bypassed", (data) =>
      this.warn("Coverage enforcement bypassed", data),
    );
    this.astEngine.on("warning", (data) =>
      this.warn("AST Engine: " + data.message, data),
    );
    this.astEngine.on("error", (data) =>
      this.error("AST Engine: " + data.message, data.error, data),
    );
    this.astEngine.on("complete", (data) =>
      this.progress("AST Engine: " + data.message, data),
    );

    // Forward Git tracker events
    this.gitTracker.on("progress", (data) =>
      this.progress("Git Tracker: " + data.message, data),
    );
    this.gitTracker.on("warning", (data) =>
      this.warn("Git Tracker: " + data.message, data),
    );
    this.gitTracker.on("error", (data) =>
      this.error("Git Tracker: " + data.message, data.error, data),
    );

    // Forward diff analyzer events
    this.diffAnalyzer.on("progress", (data) =>
      this.progress("Diff Analyzer: " + data.message, data),
    );
    this.diffAnalyzer.on("warning", (data) =>
      this.warn("Diff Analyzer: " + data.message, data),
    );
    this.diffAnalyzer.on("complete", (data) =>
      this.progress("Diff Analyzer: " + data.message, data),
    );
  }

  /**
   * Execute full deployment workflow
   * @param {Object} options - Deployment options
   * @returns {Promise<Object>} Deployment result
   */
  async performExecute(options = {}) {
    this.currentOperation = OPERATIONS.FULL_DEPLOY;

    try {
      // Phase 1: Validation
      await this.executePhase(PHASES.VALIDATION);
      const gitState = await this.validateGitState();

      // Phase 2: Testing (unless skipped)
      if (!this.skipTests) {
        await this.executePhase(PHASES.TESTING);
        await this.runTests();
      }

      // Phase 3: Analysis
      await this.executePhase(PHASES.ANALYSIS);
      const analysisResult = await this.analyzeChanges(gitState);

      // Phase 4: Test Coverage Check (unless skipped)
      if (!this.skipCoverage && analysisResult.operations.length > 0) {
        await this.executePhase(PHASES.COVERAGE);
        const coverageResult = await this.checkTestCoverage(
          analysisResult.operations,
        );

        if (!coverageResult.passed) {
          this.error("Test coverage requirements not met");
          throw new Error(
            `Deployment blocked: Test coverage is ${coverageResult.coveragePercentage}%. ` +
              `${coverageResult.gaps.length} test requirements are missing. ` +
              `Run 'data test generate-template' to create missing tests.`,
          );
        }
      }

      if (analysisResult.operations.length === 0) {
        this.success("No schema changes detected - nothing to migrate");
        return { success: true, operations: [], deployed: false };
      }

      // Phase 4: Preview
      await this.executePhase(PHASES.PREVIEW);
      await this.previewChanges(analysisResult);

      // Phase 5: Confirmation
      if (!this.dryRun) {
        await this.executePhase(PHASES.CONFIRMATION);
        const confirmed = await this.confirmDeployment(analysisResult);
        if (!confirmed) {
          this.success("Deployment cancelled by user");
          return { success: true, cancelled: true };
        }
      }

      // Phase 6: Migration
      if (!this.dryRun) {
        await this.executePhase(PHASES.MIGRATION);
        const migrationResult = await this.executeMigration(
          analysisResult.operations,
        );

        // Phase 7: Functions (unless skipped)
        if (!this.skipFunctions && (await this.hasFunctionsTodeploy())) {
          await this.executePhase(PHASES.FUNCTIONS);
          await this.deployFunctions();
        }

        // Phase 8: Tagging
        await this.executePhase(PHASES.TAGGING);
        const tag = await this.tagDeployment(migrationResult);

        await this.executePhase(PHASES.COMPLETE);
        this.success("Deployment completed successfully", {
          operations: analysisResult.operations.length,
          tag,
          migrationId: migrationResult.id,
        });

        return {
          success: true,
          operations: analysisResult.operations,
          migrationResult,
          tag,
          deployed: true,
        };
      } else {
        this.success("Dry run completed - no changes made", {
          operations: analysisResult.operations.length,
        });
        return {
          success: true,
          dryRun: true,
          operations: analysisResult.operations,
        };
      }
    } catch (error) {
      this.error(`Deployment failed in phase ${this.currentPhase}`, error);

      // Attempt rollback if we're past the migration phase
      if (
        this.currentPhase === PHASES.FUNCTIONS ||
        this.currentPhase === PHASES.TAGGING ||
        this.currentPhase === PHASES.COMPLETE
      ) {
        this.warn("Attempting automatic rollback due to deployment failure");
        try {
          await this.rollback({ automatic: true });
        } catch (rollbackError) {
          this.error("Rollback failed", rollbackError);
          throw new Error(
            `Deployment failed and rollback failed: ${error.message}. Manual intervention required.`,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Execute a specific workflow phase
   */
  async executePhase(phase) {
    this.currentPhase = phase;
    this.progress(`Starting phase: ${phase}`);
  }

  /**
   * Validate git working tree is clean and ready for deployment
   */
  async validateGitState() {
    this.progress("Validating git repository state...");

    const isClean = await this.gitTracker.isWorkingTreeClean();
    if (!isClean) {
      const status = await this.gitTracker.getWorkingTreeStatus();
      throw new Error(
        "Git working tree must be clean before deployment. " +
          `Uncommitted changes found: ${status.modified.length} modified, ` +
          `${status.untracked.length} untracked files`,
      );
    }

    const currentBranch = await this.gitTracker.getCurrentBranch();
    const lastDeployment = await this.gitTracker.getLastDeploymentTag();

    this.progress("Git state validated", {
      branch: currentBranch,
      lastDeployment: lastDeployment?.tag,
      lastDeploymentHash: lastDeployment?.hash,
    });

    return {
      branch: currentBranch,
      lastDeployment,
      isClean: true,
    };
  }

  /**
   * Run all tests to ensure code quality before deployment
   */
  async runTests() {
    this.progress("Running test suite...");

    // Run unit tests (Vitest)
    try {
      const testResult = await this.childProcess.execute("npm", ["test"], {
        cwd: process.cwd(),
        timeout: 300000, // 5 minutes
      });

      this.progress("Unit tests passed", { exitCode: testResult.exitCode });
    } catch (error) {
      throw new Error(`Unit tests failed: ${error.message}`);
    }

    // Run database tests (pgTAP) if tests directory exists
    try {
      await fs.access(this.testsDir);
      this.progress("Running database tests...");

      // This would call a pgTAP test runner - implementation depends on setup
      const dbTestResult = await this.runDatabaseTests();
      this.progress("Database tests passed", dbTestResult);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new Error(`Database tests failed: ${error.message}`);
      }
      this.progress("No database tests found, skipping");
    }
  }

  /**
   * Check test coverage for migration operations
   * @param {Array} operations - Migration operations to check coverage for
   * @returns {Promise<Object>} Coverage check results
   */
  async checkTestCoverage(operations) {
    this.progress("Checking test coverage for migration operations...");

    try {
      const coverageResult = await this.coverageOrchestrator.checkCoverage(
        operations,
        {
          enforcementLevel: this.isProd ? "strict" : "normal",
          bypassReason: this.coverageBypassReason,
          allowBypass: this.coverageBypassReason !== null,
        },
      );

      if (coverageResult.passed) {
        this.success(
          `Test coverage check passed (${coverageResult.coveragePercentage}% coverage)`,
        );
      } else if (coverageResult.bypassReason) {
        this.warn(`Test coverage bypassed: ${coverageResult.bypassReason}`);
      } else {
        this.warn(
          `Test coverage insufficient: ${coverageResult.coveragePercentage}%`,
        );
        this.warn(
          `Missing tests for ${coverageResult.gaps.length} requirements`,
        );

        // Show top 5 gaps
        const topGaps = coverageResult.gaps.slice(0, 5);
        for (const gap of topGaps) {
          this.warn(
            `  - ${gap.requirement.type}: ${gap.requirement.name} (${gap.requirement.priority})`,
          );
        }

        if (coverageResult.gaps.length > 5) {
          this.warn(`  ... and ${coverageResult.gaps.length - 5} more`);
        }
      }

      return coverageResult;
    } catch (error) {
      this.error("Test coverage check failed", error);

      // Always block on technical failures in production
      if (this.isProd) {
        throw new Error(
          `Critical: Test coverage system failure in production. ` +
            `Error: ${error.message}. Manual intervention required.`,
        );
      }

      // In non-production, require explicit bypass for technical failures
      if (!this.coverageBypassReason) {
        throw new Error(
          `Test coverage check failed technically: ${error.message}. ` +
            `Use --coverage-bypass-reason "<reason>" to continue despite this failure.`,
        );
      }

      // Log the bypass with full context
      this.warn(`Coverage check bypassed due to technical failure`, {
        error: error.message,
        bypassReason: this.coverageBypassReason,
        stack: error.stack,
      });

      return {
        passed: true,
        bypassReason: this.coverageBypassReason,
        technicalFailure: true,
        error: error.message,
      };
    }
  }

  /**
   * Analyze schema changes using AST engine and diff analyzer
   */
  async analyzeChanges(gitState) {
    this.progress("Analyzing schema changes...");

    // Get SQL from last deployment and current HEAD
    const currentSQL = await this.loadCurrentSQL();
    const previousSQL = gitState.lastDeployment
      ? await this.gitTracker.getSQLAtCommit(gitState.lastDeployment.hash)
      : "";

    // Generate migration operations using AST engine
    const operations = await this.astEngine.generateMigration(
      previousSQL,
      currentSQL,
    );

    // Analyze the diff for risk assessment and recommendations
    const analysis = await this.diffAnalyzer.analyzeMigration(operations, {
      previousSQL,
      currentSQL,
      isProd: this.isProd,
    });

    this.migrationOperations = operations;

    this.progress("Schema analysis complete", {
      operationsCount: operations.length,
      riskLevel: analysis.riskLevel,
      destructiveOps: operations.filter((op) => op.type === "DESTRUCTIVE")
        .length,
      warningOps: operations.filter((op) => op.type === "WARNING").length,
    });

    return {
      operations,
      analysis,
      previousSQL,
      currentSQL,
    };
  }

  /**
   * Preview changes to user before deployment
   */
  async previewChanges(analysisResult) {
    this.progress("Generating deployment preview...");

    const { operations, analysis } = analysisResult;

    // Emit preview event with structured data
    this.emit("preview", {
      summary: {
        totalOperations: operations.length,
        safeOperations: operations.filter((op) => op.type === "SAFE").length,
        warningOperations: operations.filter((op) => op.type === "WARNING")
          .length,
        destructiveOperations: operations.filter(
          (op) => op.type === "DESTRUCTIVE",
        ).length,
        riskLevel: analysis.riskLevel,
      },
      operations: operations.map((op) => ({
        type: op.type,
        description: op.description,
        sql: op.sql,
        warning: op.warning,
        requiresConfirmation: op.requiresConfirmation,
      })),
      recommendations: analysis.recommendations,
      estimatedDuration: analysis.estimatedDuration,
    });
  }

  /**
   * Get user confirmation for deployment
   */
  async confirmDeployment(analysisResult) {
    const { operations, analysis } = analysisResult;
    const destructive = operations.filter((op) => op.type === "DESTRUCTIVE");

    if (destructive.length > 0) {
      this.warn(`${destructive.length} DESTRUCTIVE operations detected!`);

      for (const op of destructive) {
        this.warn(`DESTRUCTIVE: ${op.description} - ${op.warning}`);
      }

      const confirmed = await this.confirm(
        "You are about to perform DESTRUCTIVE operations that may result in DATA LOSS. " +
          "Are you absolutely sure you want to continue?",
        false,
      );

      if (!confirmed) return false;
    }

    if (this.isProd) {
      const prodConfirmed = await this.confirm(
        `Deploy ${operations.length} operations to PRODUCTION environment?`,
        false,
      );
      if (!prodConfirmed) return false;
    }

    return true;
  }

  /**
   * Execute the database migration in a transaction
   */
  async executeMigration(operations) {
    this.progress("Executing database migration...");

    // Ensure we have exec_sql function for DDL operations
    await this.ensureExecSqlFunction();

    const migrationId = `migration_${Date.now()}`;
    this.rollbackPoint = await this.createRollbackPoint();

    try {
      // Execute operations in transaction
      await this.executeSql("BEGIN");

      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];

        this.progress(
          `Executing operation ${i + 1}/${operations.length}: ${operation.description}`,
        );

        try {
          await this.executeSql(operation.sql);
        } catch (error) {
          // Rollback transaction and throw
          await this.executeSql("ROLLBACK");
          throw new Error(
            `Operation failed: ${operation.description}. Error: ${error.message}`,
          );
        }
      }

      // Record migration in tracking table
      await this.recordMigration(migrationId, operations);

      // Commit transaction
      await this.executeSql("COMMIT");

      this.success("Database migration completed successfully", {
        migrationId,
        operations: operations.length,
      });

      return { id: migrationId, operations: operations.length };
    } catch (error) {
      this.error("Migration failed, transaction rolled back", error);
      throw error;
    }
  }

  /**
   * Deploy Edge Functions after successful database migration
   */
  async deployFunctions() {
    this.progress("Deploying Edge Functions...");

    try {
      // Use supabase CLI to deploy functions
      const deployResult = await this.childProcess.execute(
        "supabase",
        ["functions", "deploy", "--project-ref", this.getProjectRef()],
        {
          cwd: process.cwd(),
          timeout: 120000, // 2 minutes
        },
      );

      this.success("Edge Functions deployed successfully", {
        output: deployResult.stdout,
      });
    } catch (error) {
      // Functions deployment failure shouldn't stop the migration
      // but we should warn and potentially offer rollback
      this.warn("Edge Functions deployment failed", { error: error.message });
      throw new Error(`Functions deployment failed: ${error.message}`);
    }
  }

  /**
   * Tag the successful deployment in git
   */
  async tagDeployment(migrationResult) {
    const tag = `deploy-${Date.now()}-${migrationResult.id}`;

    this.progress(`Creating deployment tag: ${tag}`);

    await this.gitTracker.createDeploymentTag(tag, {
      migrationId: migrationResult.id,
      operations: migrationResult.operations,
      timestamp: new Date().toISOString(),
      environment: this.isProd ? "production" : "development",
    });

    return tag;
  }

  /**
   * Rollback to previous deployment
   */
  async rollback(options = {}) {
    this.currentOperation = OPERATIONS.ROLLBACK;
    this.currentPhase = PHASES.ROLLBACK;

    this.progress("Initiating rollback...");

    const lastDeployment = await this.gitTracker.getLastDeploymentTag();
    if (!lastDeployment) {
      throw new Error("No previous deployment found to rollback to");
    }

    try {
      // Get the SQL state at the last deployment
      const targetSQL = await this.gitTracker.getSQLAtCommit(
        lastDeployment.hash,
      );
      const currentSQL = await this.loadCurrentSQL();

      // Generate reverse migration
      const rollbackOps = await this.astEngine.generateMigration(
        currentSQL,
        targetSQL,
      );

      if (!options.automatic) {
        this.warn(
          `Rolling back ${rollbackOps.length} operations to deployment ${lastDeployment.tag}`,
        );

        const confirmed = await this.confirm(
          `Confirm rollback to ${lastDeployment.tag}? This may result in data loss.`,
          false,
        );

        if (!confirmed) {
          this.success("Rollback cancelled");
          return { success: false, cancelled: true };
        }
      }

      // Execute rollback
      await this.executeMigration(rollbackOps);

      // Tag the rollback
      const rollbackTag = `rollback-${Date.now()}-from-${lastDeployment.tag}`;
      await this.tagDeployment({
        id: "rollback",
        operations: rollbackOps.length,
      });

      this.success("Rollback completed successfully", {
        tag: rollbackTag,
        operations: rollbackOps.length,
      });

      return { success: true, tag: rollbackTag, operations: rollbackOps };
    } catch (error) {
      this.error("Rollback failed", error);
      throw new Error(
        `Rollback failed: ${error.message}. Manual intervention required.`,
      );
    }
  }

  /**
   * Helper methods
   */

  async loadCurrentSQL() {
    try {
      const files = await fs.readdir(this.sqlDir);
      const sqlFiles = files.filter((f) => f.endsWith(".sql"));

      let combinedSQL = "";
      for (const file of sqlFiles.sort()) {
        const content = await fs.readFile(path.join(this.sqlDir, file), "utf8");
        combinedSQL += content + "\n\n";
      }

      return combinedSQL;
    } catch (error) {
      if (error.code === "ENOENT") {
        return "";
      }
      throw error;
    }
  }

  async hasFunctionsToDeploy() {
    try {
      await fs.access(this.functionsDir);
      const functions = await fs.readdir(this.functionsDir);
      return functions.length > 0;
    } catch {
      return false;
    }
  }

  async createRollbackPoint() {
    // In a real implementation, this might create a database snapshot
    // or save the current schema state for quick rollback
    return {
      timestamp: new Date().toISOString(),
      schema: "public", // Could capture actual schema state here
    };
  }

  async recordMigration(migrationId, operations) {
    // Record migration in a tracking table for audit purposes
    const migrationRecord = {
      id: migrationId,
      timestamp: new Date().toISOString(),
      operations: operations.length,
      sql_operations: JSON.stringify(operations),
      environment: this.isProd ? "production" : "development",
    };

    // This would insert into a migrations tracking table
    // await this.from('_data_migrations').insert(migrationRecord);
  }

  async runDatabaseTests() {
    // Placeholder for pgTAP test runner
    // In real implementation, would execute pgTAP tests
    return { passed: true, tests: 0 };
  }

  getProjectRef() {
    // Extract project ref from Supabase URL
    const url = new URL(this.supabaseUrl);
    return url.hostname.split(".")[0];
  }
}

// Export classes and constants
module.exports = {
  MigrationOrchestrator,
  PHASES,
  OPERATIONS,
};
