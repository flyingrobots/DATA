/**
 * Test Run Command
 */

const { Client } = require("pg");
const chalk = require("chalk").default || require("chalk");
const fs = require("fs").promises;
const path = require("path");
const TestCommand = require("../../lib/TestCommand");
const ResultParser = require("../../lib/test/ResultParser");
const { JUnitFormatter, JSONFormatter } = require("../../lib/test/formatters");
const TestCache = require("../../lib/test/TestCache");
const Config = require("../../lib/config");

/**
 * Run compiled tests using pgTAP
 */
class RunCommand extends TestCommand {
  constructor(
    databaseUrl,
    serviceRoleKey = null,
    testsDir,
    outputDir,
    logger = null,
    isProd = false,
    config = null,
  ) {
    super(databaseUrl, serviceRoleKey, testsDir, outputDir, logger, isProd);
    this.parser = new ResultParser();
    this.config = config;

    // Initialize test cache for performance optimization
    this.testCache = new TestCache(".data-cache/test-results", logger);

    // Performance tracking
    this.performanceMetrics = {
      totalExecutionTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      testsExecuted: 0,
      testsFromCache: 0,
    };
  }

  /**
   * Execute test run
   */
  async performExecute(options = {}) {
    const startTime = Date.now();
    this.emit("start", { isProd: this.isProd, options });

    // Enable/disable cache based on options
    const cacheEnabled = options.cache !== false; // Cache enabled by default

    try {
      // Load and apply test configuration
      const testConfig = await this._getTestConfig();
      options = this._applyTestConfig(options, testConfig);

      this.progress("Connecting to database...");
      const client = await this._createDatabaseClient();

      // Set query timeout based on config
      if (testConfig.test_timeout && testConfig.test_timeout > 0) {
        client.query_timeout = testConfig.test_timeout * 1000; // Convert to milliseconds
      }

      try {
        this.progress("Discovering test functions...");
        const testFunctions = await this._discoverTestFunctions(client);

        if (testFunctions.length === 0) {
          this.warn("No test functions found in test schema");
          const emptyResults = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            testFunctions: [],
          };
          this.emit("complete", { results: emptyResults });
          return emptyResults;
        }

        this.success(`Found ${testFunctions.length} test function(s)`);

        // Determine which tests to run
        const testsToRun = this._filterTestFunctions(testFunctions, options);

        if (testsToRun.length === 0) {
          const filterDesc = this._getFilterDescription(options);
          this.warn(`No test functions match filter criteria: ${filterDesc}`);
          const emptyResults = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            testFunctions: [],
          };
          this.emit("complete", { results: emptyResults });
          return emptyResults;
        }

        this.progress(`Running ${testsToRun.length} test function(s)...`);

        // Determine if parallel execution is enabled (default: true for better performance)
        const runParallel = options.parallel !== false;
        const maxConcurrency = options.maxConcurrency || 5; // Limit concurrent database connections

        // Execute tests with caching
        let allResults = [];

        if (runParallel) {
          // Parallel execution for better performance
          const testPromises = testsToRun.map(async (testFunc) => {
            const funcStartTime = Date.now();

            // Try cache first if enabled
            let tapOutput = null;
            let fromCache = false;

            if (cacheEnabled) {
              const hash = await this.testCache.calculateHash(
                testFunc,
                this.databaseUrl,
                options,
              );
              const cachedResult = await this.testCache.getCachedResult(hash);

              if (cachedResult && cachedResult.tapOutput) {
                tapOutput = cachedResult.tapOutput;
                fromCache = true;
                this.performanceMetrics.cacheHits++;
                this.performanceMetrics.testsFromCache++;
                this.progress(
                  `${chalk.blue("✓")} ${testFunc} (cached, saved ~${cachedResult.originalDuration || 0}ms)`,
                );
              } else {
                this.performanceMetrics.cacheMisses++;
              }
            }

            // Execute test if not cached
            if (!tapOutput) {
              this.progress(`Running ${testFunc}...`);
              const testStartTime = Date.now();
              tapOutput = await this._executeTestFunction(client, testFunc);
              const testDuration = Date.now() - testStartTime;

              // Cache the result if caching is enabled
              if (cacheEnabled) {
                try {
                  const hash = await this.testCache.calculateHash(
                    testFunc,
                    this.databaseUrl,
                    options,
                  );
                  await this.testCache.storeResult(
                    hash,
                    {
                      tapOutput: tapOutput,
                      originalDuration: testDuration,
                    },
                    {
                      testFunction: testFunc,
                      duration: testDuration,
                      databaseUrl: this.databaseUrl,
                      options: options,
                    },
                  );
                } catch (cacheError) {
                  this.warn(
                    `Failed to cache result for ${testFunc}: ${cacheError.message}`,
                  );
                }
              }
            }

            this.performanceMetrics.testsExecuted++;
            return {
              function: testFunc,
              output: tapOutput,
              fromCache: fromCache,
              duration: Date.now() - funcStartTime,
            };
          });

          // Process tests in batches to limit concurrent connections
          for (let i = 0; i < testPromises.length; i += maxConcurrency) {
            const batch = testPromises.slice(i, i + maxConcurrency);
            const batchResults = await Promise.all(batch);
            allResults = allResults.concat(batchResults);
          }
        } else {
          // Sequential execution (fallback mode or when explicitly requested)
          for (const testFunc of testsToRun) {
            const funcStartTime = Date.now();

            // Try cache first if enabled
            let tapOutput = null;
            let fromCache = false;

            if (cacheEnabled) {
              const hash = await this.testCache.calculateHash(
                testFunc,
                this.databaseUrl,
                options,
              );
              const cachedResult = await this.testCache.getCachedResult(hash);

              if (cachedResult && cachedResult.tapOutput) {
                tapOutput = cachedResult.tapOutput;
                fromCache = true;
                this.performanceMetrics.cacheHits++;
                this.performanceMetrics.testsFromCache++;
                this.progress(
                  `${chalk.blue("✓")} ${testFunc} (cached, saved ~${cachedResult.originalDuration || 0}ms)`,
                );
              } else {
                this.performanceMetrics.cacheMisses++;
              }
            }

            // Execute test if not cached
            if (!tapOutput) {
              this.progress(`Running ${testFunc}...`);
              const testStartTime = Date.now();
              tapOutput = await this._executeTestFunction(client, testFunc);
              const testDuration = Date.now() - testStartTime;

              // Cache the result if caching is enabled
              if (cacheEnabled) {
                try {
                  const hash = await this.testCache.calculateHash(
                    testFunc,
                    this.databaseUrl,
                    options,
                  );
                  await this.testCache.storeResult(
                    hash,
                    {
                      tapOutput: tapOutput,
                      originalDuration: testDuration,
                    },
                    {
                      testFunction: testFunc,
                      duration: testDuration,
                      databaseUrl: this.databaseUrl,
                      options: options,
                    },
                  );
                } catch (cacheError) {
                  this.warn(
                    `Failed to cache result for ${testFunc}: ${cacheError.message}`,
                  );
                }
              }
            }

            this.performanceMetrics.testsExecuted++;
            allResults.push({
              function: testFunc,
              output: tapOutput,
              fromCache: fromCache,
              duration: Date.now() - funcStartTime,
            });
          }
        }

        // Parse all results and add performance metadata
        const combinedResults = this._combineResults(allResults);

        // Add cache performance metrics
        const totalTime = Date.now() - startTime;
        combinedResults.performance = {
          totalExecutionTime: totalTime,
          cacheEnabled: cacheEnabled,
          cacheHits: this.performanceMetrics.cacheHits,
          cacheMisses: this.performanceMetrics.cacheMisses,
          testsExecuted: this.performanceMetrics.testsExecuted,
          testsFromCache: this.performanceMetrics.testsFromCache,
          cacheHitRate:
            this.performanceMetrics.testsExecuted > 0
              ? (
                  (this.performanceMetrics.testsFromCache /
                    this.performanceMetrics.testsExecuted) *
                  100
                ).toFixed(1)
              : "0.0",
          averageTestTime:
            this.performanceMetrics.testsExecuted > 0
              ? Math.round(totalTime / this.performanceMetrics.testsExecuted)
              : 0,
        };

        // Handle output formatting based on options
        await this._handleOutputFormat(combinedResults, options);

        this.emit("complete", { results: combinedResults });
        return combinedResults;
      } finally {
        await client.end();
      }
    } catch (error) {
      this.error("Failed to run tests", error);
      this.emit("failed", { error });
      throw error;
    }
  }

  /**
   * Create database client using direct database URL
   * @private
   */
  async _createDatabaseClient() {
    if (!this.databaseUrl) {
      throw new Error(
        `Database connection string not configured for ${this.isProd ? "production" : "local"} environment`,
      );
    }

    const client = new Client({
      connectionString: this.databaseUrl,
    });

    await client.connect();
    return client;
  }

  /**
   * Discover test functions in the test schema
   * @private
   */
  async _discoverTestFunctions(client) {
    const query = `
      SELECT proname 
      FROM pg_proc 
      WHERE pronamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = 'test'
      ) 
      AND proname LIKE 'run_%_tests'
      ORDER BY proname
    `;

    const result = await client.query(query);
    return result.rows.map((row) => row.proname);
  }

  /**
   * Filter test functions by multiple criteria
   * @private
   */
  _filterTestFunctions(testFunctions, options) {
    let filtered = [...testFunctions];

    // Apply suite filter
    if (options.suite) {
      filtered = this._filterBySuite(filtered, options.suite);
    }

    // Apply pattern filter (legacy support for options.function)
    const pattern = options.pattern || options.function;
    if (pattern) {
      filtered = this._filterByPattern(filtered, pattern);
    }

    // Apply tag filter
    if (options.tag) {
      filtered = this._filterByTag(filtered, options.tag);
    }

    return filtered;
  }

  /**
   * Filter test functions by suite
   * @private
   */
  _filterBySuite(testFunctions, suite) {
    return testFunctions.filter((func) => {
      // Handle suite names like "admin" -> "run_admin_*" (e.g., "run_admin_delete_pet_tests")
      // Also handle direct matches like "admin" -> "run_admin_tests"
      const regex = new RegExp(`^run_${suite}(_.*)?_tests$`, "i");
      return regex.test(func);
    });
  }

  /**
   * Filter test functions by pattern
   * @private
   */
  _filterByPattern(testFunctions, pattern) {
    // Convert glob patterns to regex patterns
    const regexPattern = this._globToRegex(pattern);
    const regex = new RegExp(regexPattern, "i");
    return testFunctions.filter((func) => regex.test(func));
  }

  /**
   * Convert glob pattern to regex pattern
   * @private
   */
  _globToRegex(pattern) {
    // Escape special regex characters except * and ?
    let regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
      .replace(/\*/g, ".*") // Convert * to .*
      .replace(/\?/g, "."); // Convert ? to .

    // Anchor the pattern to match the whole string
    return `^${regex}$`;
  }

  /**
   * Filter test functions by tag (placeholder for future tag support)
   * @private
   */
  _filterByTag(testFunctions, tag) {
    // For now, this is a placeholder since we don't have tag parsing implemented yet
    // In a real implementation, we would query the database for function comments/metadata
    this.warn(`Tag filtering not yet implemented. Ignoring --tag ${tag}`);
    return testFunctions;
  }

  /**
   * Get a description of current filter criteria
   * @private
   */
  _getFilterDescription(options) {
    const filters = [];

    if (options.suite) {
      filters.push(`suite="${options.suite}"`);
    }

    const pattern = options.pattern || options.function;
    if (pattern) {
      filters.push(`pattern="${pattern}"`);
    }

    if (options.tag) {
      filters.push(`tag="${options.tag}"`);
    }

    return filters.length > 0 ? filters.join(", ") : "none";
  }

  /**
   * Execute a single test function and return TAP output
   * @private
   */
  async _executeTestFunction(client, functionName) {
    const query = `SELECT * FROM test.${functionName}()`;

    try {
      const result = await client.query(query);
      // Join all result rows into TAP output
      return result.rows.map((row) => Object.values(row)[0]).join("\n");
    } catch (error) {
      // Return TAP format error
      return `not ok 1 ${functionName} failed: ${error.message}`;
    }
  }

  /**
   * Combine results from multiple test functions
   * @private
   */
  _combineResults(allResults) {
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let allTests = [];
    let allDiagnostics = [];
    const testFunctions = [];

    for (const { function: funcName, output } of allResults) {
      const funcResults = this.parser.parse(output);

      totalPassed += funcResults.passed;
      totalFailed += funcResults.failed;
      totalSkipped += funcResults.skipped;

      // Prefix test descriptions with function name
      const prefixedTests = funcResults.tests.map((test) => ({
        ...test,
        description: `${funcName}: ${test.description}`,
        function: funcName,
      }));

      allTests = allTests.concat(prefixedTests);
      allDiagnostics = allDiagnostics.concat(funcResults.diagnostics);

      testFunctions.push({
        name: funcName,
        passed: funcResults.passed,
        failed: funcResults.failed,
        skipped: funcResults.skipped,
        total: funcResults.total,
        success: funcResults.failed === 0,
      });
    }

    return {
      total: totalPassed + totalFailed + totalSkipped,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      tests: allTests,
      diagnostics: allDiagnostics,
      testFunctions,
    };
  }

  /**
   * Handle output formatting based on format option
   * @private
   */
  async _handleOutputFormat(results, options = {}) {
    const format = options.format || "console";
    const outputFile = options.output;

    switch (format.toLowerCase()) {
      case "junit":
        await this._outputJUnit(results, outputFile);
        break;
      case "json":
        await this._outputJSON(results, outputFile);
        break;
      case "console":
      default:
        this._displayResults(results);
        break;
    }
  }

  /**
   * Output JUnit XML format
   * @private
   */
  async _outputJUnit(results, outputFile) {
    const formatter = new JUnitFormatter();
    const xmlOutput = formatter.format(results);

    if (outputFile) {
      await this._writeOutputFile(
        xmlOutput,
        outputFile,
        formatter.getFileExtension(),
      );
      this.success(`JUnit XML results written to: ${outputFile}`);
    } else {
      console.log(xmlOutput);
    }
  }

  /**
   * Output JSON format
   * @private
   */
  async _outputJSON(results, outputFile) {
    const formatter = new JSONFormatter();
    const jsonOutput = formatter.format(results);

    if (outputFile) {
      await this._writeOutputFile(
        jsonOutput,
        outputFile,
        formatter.getFileExtension(),
      );
      this.success(`JSON results written to: ${outputFile}`);
    } else {
      console.log(jsonOutput);
    }
  }

  /**
   * Write output to file with proper extension
   * @private
   */
  async _writeOutputFile(content, filePath, defaultExtension) {
    let fullPath = filePath;

    // Add default extension if not present
    if (!path.extname(filePath)) {
      fullPath = filePath + defaultExtension;
    }

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, content, "utf8");
  }

  /**
   * Display formatted test results (console output)
   * @private
   */
  _displayResults(results) {
    const {
      total,
      passed,
      failed,
      skipped,
      tests,
      diagnostics,
      testFunctions,
    } = results;

    console.log(""); // Empty line for spacing

    // Summary by function
    if (testFunctions.length > 1) {
      console.log(chalk.bold("Test Functions:"));
      testFunctions.forEach((func) => {
        const symbol = func.success ? chalk.green("✓") : chalk.red("✗");
        const summary = `${func.passed}/${func.total} passed`;
        const skippedText = func.skipped > 0 ? `, ${func.skipped} skipped` : "";
        console.log(`  ${symbol} ${func.name}: ${summary}${skippedText}`);
      });
      console.log(""); // Empty line
    }

    // Overall summary
    if (failed > 0) {
      console.log(chalk.red.bold(`✗ ${failed}/${total} tests failed`));
    } else if (skipped > 0) {
      console.log(
        chalk.yellow.bold(
          `✓ ${passed}/${total} tests passed (${skipped} skipped)`,
        ),
      );
    } else if (total > 0) {
      console.log(chalk.green.bold(`✓ All ${passed}/${total} tests passed`));
    } else {
      console.log(chalk.gray.bold("No tests executed"));
    }

    // Failed test details
    if (failed > 0) {
      console.log(""); // Empty line
      console.log(chalk.red.bold("Failed Tests:"));
      tests
        .filter((test) => test.status === "fail")
        .forEach((test) => {
          console.log(chalk.red(`  ✗ ${test.description}`));
        });
    }

    // Diagnostics
    if (diagnostics.length > 0) {
      console.log(""); // Empty line
      console.log(chalk.gray.bold("Diagnostics:"));
      diagnostics.forEach((diagnostic) => {
        console.log(chalk.gray(`  ${diagnostic}`));
      });
    }

    // Performance metrics
    if (results.performance) {
      console.log(""); // Empty line
      console.log(chalk.cyan.bold("Performance:"));

      const perf = results.performance;
      console.log(chalk.cyan(`  Execution time: ${perf.totalExecutionTime}ms`));
      console.log(chalk.cyan(`  Average per test: ${perf.averageTestTime}ms`));

      if (perf.cacheEnabled) {
        if (perf.testsFromCache > 0) {
          console.log(
            chalk.green(
              `  Cache performance: ${perf.cacheHitRate}% hit rate (${perf.testsFromCache}/${perf.testsExecuted} from cache)`,
            ),
          );

          // Calculate estimated time saved
          const avgExecutionTime = perf.averageTestTime;
          const estimatedTimeSaved =
            perf.testsFromCache * avgExecutionTime * 0.8; // Assume 80% time savings
          if (estimatedTimeSaved > 0) {
            console.log(
              chalk.green(
                `  Estimated time saved: ~${Math.round(estimatedTimeSaved)}ms`,
              ),
            );
          }
        } else {
          console.log(
            chalk.yellow(
              `  Cache performance: 0% hit rate (building cache...)`,
            ),
          );
        }
      } else {
        console.log(chalk.gray(`  Cache: disabled`));
      }
    }
  }

  /**
   * Get exit code based on results
   * @param {object} results - Test results
   * @returns {number} Exit code
   */
  getExitCode(results) {
    return results.failed > 0 ? 1 : 0;
  }

  /**
   * Get test configuration from config object or load from file
   * @private
   */
  async _getTestConfig() {
    if (this.config) {
      return this.config.getTestConfig();
    }

    try {
      const config = await Config.load();
      return config.getTestConfig();
    } catch (error) {
      this.logger.debug("Could not load config file, using defaults");
      const defaultConfig = new Config();
      return defaultConfig.getTestConfig();
    }
  }

  /**
   * Apply test configuration to options
   * @private
   */
  _applyTestConfig(options, testConfig) {
    const mergedOptions = { ...options };

    // Apply default output format if not specified
    if (
      !mergedOptions.format &&
      testConfig.output_formats &&
      testConfig.output_formats.length > 0
    ) {
      mergedOptions.format = testConfig.output_formats[0];
    }

    return mergedOptions;
  }
}

module.exports = RunCommand;
