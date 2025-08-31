/**
 * Test Validate Command - SQL syntax validation for pgTAP tests
 */

const TestCommand = require('../../lib/TestCommand');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Validate SQL syntax and pgTAP function usage in test files
 */
class ValidateCommand extends TestCommand {
  constructor(
    databaseUrl = null,
    serviceRoleKey = null,
    testsDir,
    outputDir = null,
    logger = null,
    isProd = false,
    pathResolver = null
  ) {
    super(databaseUrl, serviceRoleKey, testsDir, outputDir, logger, isProd, pathResolver);
    
    // Validation doesn't require database connection
    this.requiresProductionConfirmation = false;
    
    // Initialize validation cache
    this.validationCache = new Map();
    this.cacheDir = path.join(process.cwd(), '.data-cache', 'validation');
    this.cacheFile = path.join(this.cacheDir, 'validation-cache.json');
    
    // Valid pgTAP function names
    this.pgTapFunctions = new Set([
      // Basic test functions
      'ok', 'nok', 'pass', 'fail',
      // Comparison functions
      'is', 'isnt', 'like', 'unlike', 'matches', 'imatches',
      // NULL testing
      'is_empty', 'isnt_empty', 'is_null', 'isnt_null', 'is_not_null',
      // Numeric comparison
      'cmp_ok',
      // Schema testing
      'has_schema', 'hasnt_schema', 'schema_owner_is',
      'has_table', 'hasnt_table', 'has_view', 'hasnt_view',
      'has_function', 'hasnt_function', 'function_returns',
      'has_column', 'hasnt_column', 'col_type_is', 'col_is_null', 'col_not_null',
      'col_has_default', 'col_default_is',
      // Row testing
      'results_eq', 'results_ne', 'set_eq', 'set_ne', 'bag_eq', 'bag_ne',
      'row_eq', 'throws_ok', 'throws_like', 'throws_matching', 'lives_ok',
      // Test control
      'plan', 'finish', 'diag', 'skip', 'todo', 'todo_skip'
    ]);
    
    this.validationResults = {
      filesProcessed: 0,
      syntaxErrors: [],
      pgTapIssues: [],
      structureWarnings: [],
      hasErrors: false
    };
  }

  /**
   * Load validation cache from disk
   */
  async loadCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const cacheData = await fs.readFile(this.cacheFile, 'utf8');
      const cache = JSON.parse(cacheData);
      this.validationCache = new Map(Object.entries(cache));
      this.info(`Loaded validation cache with ${this.validationCache.size} entries`);
    } catch (error) {
      // Cache doesn't exist or is invalid, start fresh
      this.validationCache = new Map();
    }
  }
  
  /**
   * Save validation cache to disk
   */
  async saveCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const cacheData = Object.fromEntries(this.validationCache);
      await fs.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      this.warn(`Failed to save validation cache: ${error.message}`);
    }
  }
  
  /**
   * Calculate hash for a file's content
   */
  async calculateFileHash(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * Check if file validation is cached and still valid
   */
  async isCacheValid(filePath) {
    const fileHash = await this.calculateFileHash(filePath);
    const cacheKey = `${filePath}:${fileHash}`;
    
    if (this.validationCache.has(cacheKey)) {
      const cached = this.validationCache.get(cacheKey);
      // Cache is valid for 24 hours
      const cacheAge = Date.now() - cached.timestamp;
      return cacheAge < 24 * 60 * 60 * 1000;
    }
    return false;
  }
  
  /**
   * Get cached validation result
   */
  getCachedResult(filePath, fileHash) {
    const cacheKey = `${filePath}:${fileHash}`;
    return this.validationCache.get(cacheKey);
  }
  
  /**
   * Store validation result in cache
   */
  setCachedResult(filePath, fileHash, result) {
    const cacheKey = `${filePath}:${fileHash}`;
    this.validationCache.set(cacheKey, {
      ...result,
      timestamp: Date.now()
    });
  }

  /**
   * Execute test validation
   */
  async performExecute(options = {}) {
    this.emit('start', { isProd: this.isProd, options });
    
    try {
      // Load cache if caching is enabled
      const cacheEnabled = options.cache !== false;
      if (cacheEnabled) {
        await this.loadCache();
      }
      
      this.progress('Scanning test files for validation...');
      
      const testFiles = await this.listTestFiles('*.sql');
      
      if (testFiles.length === 0) {
        this.warn('No test files found in tests directory');
        return this.validationResults;
      }
      
      this.progress(`Found ${testFiles.length} test files to validate`);
      
      let cachedCount = 0;
      let validatedCount = 0;
      
      // Validate each test file
      for (const filePath of testFiles) {
        if (cacheEnabled && await this.isCacheValid(filePath)) {
          const fileHash = await this.calculateFileHash(filePath);
          const cached = this.getCachedResult(filePath, fileHash);
          if (cached && !cached.hasErrors) {
            cachedCount++;
            this.progress(`✓ ${path.basename(filePath)} (cached)`);
            continue;
          }
        }
        
        await this.validateFile(filePath);
        validatedCount++;
        
        // Cache the result if no errors
        if (cacheEnabled && !this.validationResults.hasErrors) {
          const fileHash = await this.calculateFileHash(filePath);
          this.setCachedResult(filePath, fileHash, {
            hasErrors: false,
            syntaxErrors: [],
            pgTapIssues: [],
            structureWarnings: []
          });
        }
      }
      
      // Save cache if caching is enabled
      if (cacheEnabled) {
        await this.saveCache();
      }
      
      // Report results
      this.reportResults();
      
      if (cachedCount > 0) {
        this.success(`${cachedCount} files validated from cache, ${validatedCount} files validated`);
      }
      
      this.emit('complete', { validation: this.validationResults });
      return this.validationResults;
      
    } catch (error) {
      this.error('Failed to validate tests', error);
      this.emit('failed', { error });
      throw error;
    }
  }
  
  /**
   * Validate a single SQL test file
   * @param {string} filePath - Path to the test file
   */
  async validateFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath);
      
      this.validationResults.filesProcessed++;
      
      // Basic SQL syntax validation
      this.validateSqlSyntax(fileName, content);
      
      // pgTAP function validation
      this.validatePgTapUsage(fileName, content);
      
      // Test function structure validation
      this.validateTestStructure(fileName, content);
      
    } catch (error) {
      this.addSyntaxError(path.basename(filePath), 0, `File read error: ${error.message}`);
    }
  }
  
  /**
   * Validate basic SQL syntax
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   */
  validateSqlSyntax(fileName, content) {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;
      
      // Skip comments and empty lines
      if (!line || line.startsWith('--')) continue;
      
      // Check for basic syntax errors
      this.checkBasicSyntax(fileName, lineNum, line);
    }
  }
  
  /**
   * Check basic SQL syntax patterns
   * @param {string} fileName - Name of the file
   * @param {number} lineNum - Line number
   * @param {string} line - Line content
   */
  checkBasicSyntax(fileName, lineNum, line) {
    // Check for unmatched parentheses in single line
    const openParens = (line.match(/\(/g) || []).length;
    const closeParens = (line.match(/\)/g) || []).length;
    
    // Only flag obvious single-line mismatches
    if (line.includes('(') && !line.includes('$$') && openParens > closeParens + 1) {
      this.addSyntaxError(fileName, lineNum, 'Possible unmatched opening parenthesis');
    }
    
    // Check for common typos
    if (line.match(/\bSELET\b/i)) {
      this.addSyntaxError(fileName, lineNum, 'Typo: "SELET" should be "SELECT"');
    }
    
    if (line.match(/\bFROM\s+FROM\b/i)) {
      this.addSyntaxError(fileName, lineNum, 'Duplicate FROM keyword');
    }
    
    if (line.match(/\bWHERE\s+WHERE\b/i)) {
      this.addSyntaxError(fileName, lineNum, 'Duplicate WHERE keyword');
    }
    
    // Check for semicolon issues
    if (line.match(/;;+/)) {
      this.addSyntaxError(fileName, lineNum, 'Multiple consecutive semicolons');
    }
  }
  
  /**
   * Validate pgTAP function usage
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   */
  validatePgTapUsage(fileName, content) {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;
      
      // Skip comments and empty lines
      if (!line || line.startsWith('--')) continue;
      
      // Find pgTAP function calls
      const tapMatch = line.match(/\btap\.(\w+)\s*\(/i);
      if (tapMatch) {
        const functionName = tapMatch[1].toLowerCase();
        if (!this.pgTapFunctions.has(functionName)) {
          this.addPgTapIssue(fileName, lineNum, `Unknown pgTAP function: tap.${functionName}`);
        }
      }
      
      // Check for RETURN NEXT patterns
      if (line.match(/RETURN\s+NEXT/i) && !line.match(/tap\./i)) {
        this.addPgTapIssue(fileName, lineNum, 'RETURN NEXT should typically use tap.* functions');
      }
    }
  }
  
  /**
   * Validate test function structure
   * @param {string} fileName - Name of the file
   * @param {string} content - File content
   */
  validateTestStructure(fileName, content) {
    // Check for test function declarations
    const testFunctionRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+test\.(\w+)\s*\(([^)]*)\)\s*RETURNS\s+(\w+(?:\s+\w+)*)/gi;
    let match;
    
    let hasTestFunctions = false;
    
    while ((match = testFunctionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const returnType = match[3].toUpperCase();
      
      // Skip helper functions (they don't need to be pgTAP test functions)
      const isHelperFunction = functionName.startsWith('create_') || 
                               functionName.startsWith('cleanup_') ||
                               functionName.startsWith('set_') ||
                               functionName.includes('_helper') ||
                               functionName.includes('_util');
      
      if (!isHelperFunction) {
        hasTestFunctions = true;
        
        // Check return type for actual test functions
        if (!returnType.includes('SETOF TEXT')) {
          this.addStructureWarning(fileName, 0, `Function test.${functionName} should return SETOF TEXT for pgTAP compatibility`);
        }
        
        // Check function name pattern for actual test functions
        if (!functionName.includes('test') && !functionName.startsWith('run_')) {
          this.addStructureWarning(fileName, 0, `Function test.${functionName} should include 'test' or start with 'run_' for clarity`);
        }
      }
    }
    
    // Check if file has any test functions
    if (!hasTestFunctions && fileName.endsWith('.sql') && !fileName.startsWith('00_')) {
      this.addStructureWarning(fileName, 0, 'File appears to be a test file but contains no test functions');
    }
    
    // Check for plan() call
    if (hasTestFunctions && !content.match(/tap\.plan\s*\(/i)) {
      this.addStructureWarning(fileName, 0, 'Test functions should include tap.plan() to specify expected test count');
    }
    
    // Check for finish() call
    if (hasTestFunctions && !content.match(/tap\.finish\s*\(\s*\)/i)) {
      this.addStructureWarning(fileName, 0, 'Test functions should include tap.finish() at the end');
    }
  }
  
  /**
   * Add a syntax error to results
   */
  addSyntaxError(fileName, lineNum, message) {
    this.validationResults.syntaxErrors.push({ fileName, lineNum, message });
    this.validationResults.hasErrors = true;
  }
  
  /**
   * Add a pgTAP issue to results
   */
  addPgTapIssue(fileName, lineNum, message) {
    this.validationResults.pgTapIssues.push({ fileName, lineNum, message });
    this.validationResults.hasErrors = true;
  }
  
  /**
   * Add a structure warning to results
   */
  addStructureWarning(fileName, lineNum, message) {
    this.validationResults.structureWarnings.push({ fileName, lineNum, message });
  }
  
  /**
   * Report validation results
   */
  reportResults() {
    const { filesProcessed, syntaxErrors, pgTapIssues, structureWarnings, hasErrors } = this.validationResults;
    
    this.progress(`Processed ${filesProcessed} test files`);
    
    // Report syntax errors
    if (syntaxErrors.length > 0) {
      this.error(`Found ${syntaxErrors.length} syntax errors:`);
      syntaxErrors.forEach(error => {
        this.error(`  ${error.fileName}:${error.lineNum} - ${error.message}`);
      });
    }
    
    // Report pgTAP issues
    if (pgTapIssues.length > 0) {
      this.error(`Found ${pgTapIssues.length} pgTAP issues:`);
      pgTapIssues.forEach(issue => {
        this.error(`  ${issue.fileName}:${issue.lineNum} - ${issue.message}`);
      });
    }
    
    // Report structure warnings
    if (structureWarnings.length > 0) {
      this.warn(`Found ${structureWarnings.length} structure warnings:`);
      structureWarnings.forEach(warning => {
        this.warn(`  ${warning.fileName}:${warning.lineNum} - ${warning.message}`);
      });
    }
    
    // Final status
    if (hasErrors) {
      this.error('Validation failed - please fix the errors above');
      // Set exit code for CLI
      process.exitCode = 1;
    } else {
      this.success('Validation complete - no errors found');
      if (structureWarnings.length === 0) {
        this.success('All tests follow best practices');
      }
    }
  }
}

module.exports = ValidateCommand;