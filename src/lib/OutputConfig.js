/**
 * OutputConfig - Centralized path configuration for data
 * 
 * A proper class with typed properties for all paths.
 * Uses dependency injection - no singletons!
 */

const path = require('path');
const fs = require('fs');

class OutputConfig {
  constructor(
    configPath = null,
    cliSupabaseDir = null,
    cliMigrationsDir = null,
    cliTestsDir = null,
    cliSqlDir = null,
    cliFunctionsDir = null,
    cliOutputDir = null,
    cliProjectRoot = null
  ) {
    // Initialize all path properties as direct class properties
    this.projectRoot = null;
    this.supabaseDir = null;
    this.migrationsDir = null;
    this.testsDir = null;
    this.sqlDir = null;
    this.functionsDir = null;
    this.seedDir = null;
    this.supabaseConfig = null;
    this.dataConfig = null;
    this.buildDir = null;
    this.cacheDir = null;
    this.tempDir = null;
    this.logFile = null;
    this.errorLogFile = null;
    
    // Build configuration from various sources
    this._setDefaults();
    this._applyAutoDetection();
    this._applyEnvironmentVariables();
    if (configPath) {
      this._loadConfigFile(configPath);
    }
    // Apply CLI overrides with explicit parameters
    this._applyCliOptions(
      cliProjectRoot,
      cliSupabaseDir,
      cliMigrationsDir,
      cliTestsDir,
      cliSqlDir,
      cliFunctionsDir,
      cliOutputDir
    );
    this._resolveAllPaths();
    this._validatePaths();
  }

  _setDefaults() {
    const cwd = process.cwd();
    
    this.projectRoot = cwd;
    this.supabaseDir = path.join(cwd, 'supabase');
    this.migrationsDir = path.join(cwd, 'supabase', 'migrations');
    this.testsDir = path.join(cwd, 'supabase', 'tests');
    this.sqlDir = path.join(cwd, 'supabase', 'sql');
    this.functionsDir = path.join(cwd, 'supabase', 'functions');
    this.seedDir = path.join(cwd, 'supabase', 'seed');
    this.supabaseConfig = path.join(cwd, 'supabase', 'config.toml');
    this.dataConfig = path.join(cwd, '.datarc.json');
    this.buildDir = path.join(cwd, '.data', 'build');
    this.cacheDir = path.join(cwd, '.data', 'cache');
    this.tempDir = path.join(cwd, '.data', 'temp');
    this.logFile = path.join(cwd, '.data', 'data.log');
    this.errorLogFile = path.join(cwd, '.data', 'error.log');
  }

  _applyAutoDetection() {
    const cwd = process.cwd();
    
    // Check if we're inside a supabase directory
    if (fs.existsSync(path.join(cwd, 'config.toml'))) {
      this.supabaseDir = cwd;
      this.projectRoot = path.dirname(cwd);
      this._updateRelativePaths();
      return;
    }
    
    // Check if we have a supabase subdirectory
    if (fs.existsSync(path.join(cwd, 'supabase', 'config.toml'))) {
      this.projectRoot = cwd;
      this.supabaseDir = path.join(cwd, 'supabase');
      this._updateRelativePaths();
      return;
    }
    
    // Search up the tree for a project root
    let searchDir = cwd;
    let depth = 0;
    const maxDepth = 5;
    
    while (depth < maxDepth) {
      const parentDir = path.dirname(searchDir);
      if (parentDir === searchDir) break;
      
      if (fs.existsSync(path.join(parentDir, 'supabase', 'config.toml'))) {
        this.projectRoot = parentDir;
        this.supabaseDir = path.join(parentDir, 'supabase');
        this._updateRelativePaths();
        return;
      }
      
      searchDir = parentDir;
      depth++;
    }
  }

  _updateRelativePaths() {
    this.migrationsDir = path.join(this.supabaseDir, 'migrations');
    this.testsDir = path.join(this.supabaseDir, 'tests');
    this.sqlDir = path.join(this.supabaseDir, 'sql');
    this.functionsDir = path.join(this.supabaseDir, 'functions');
    this.seedDir = path.join(this.supabaseDir, 'seed');
    this.supabaseConfig = path.join(this.supabaseDir, 'config.toml');
    this.dataConfig = path.join(this.projectRoot, '.datarc.json');
    this.buildDir = path.join(this.projectRoot, '.data', 'build');
    this.cacheDir = path.join(this.projectRoot, '.data', 'cache');
    this.tempDir = path.join(this.projectRoot, '.data', 'temp');
    this.logFile = path.join(this.projectRoot, '.data', 'data.log');
    this.errorLogFile = path.join(this.projectRoot, '.data', 'error.log');
  }

  _applyEnvironmentVariables() {
    if (process.env.data_PROJECT_ROOT) this.projectRoot = process.env.data_PROJECT_ROOT;
    if (process.env.data_SUPABASE_DIR) this.supabaseDir = process.env.data_SUPABASE_DIR;
    if (process.env.data_MIGRATIONS_DIR) this.migrationsDir = process.env.data_MIGRATIONS_DIR;
    if (process.env.data_TESTS_DIR) this.testsDir = process.env.data_TESTS_DIR;
    if (process.env.data_SQL_DIR) this.sqlDir = process.env.data_SQL_DIR;
    if (process.env.data_FUNCTIONS_DIR) this.functionsDir = process.env.data_FUNCTIONS_DIR;
    if (process.env.data_BUILD_DIR) this.buildDir = process.env.data_BUILD_DIR;
    if (process.env.data_CACHE_DIR) this.cacheDir = process.env.data_CACHE_DIR;
    if (process.env.data_LOG_FILE) this.logFile = process.env.data_LOG_FILE;
  }

  _loadConfigFile(configPath) {
    const configFile = configPath || this.dataConfig;
    
    if (!fs.existsSync(configFile)) {
      return;
    }
    
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      
      if (config.paths) {
        Object.assign(this, config.paths);
      }
      
      if (config.directories) {
        Object.assign(this, config.directories);
      }
    } catch (error) {
      console.warn(`Warning: Could not parse config file ${configFile}:`, error.message);
    }
  }

  _applyCliOptions(
    projectRoot,
    supabaseDir,
    migrationsDir,
    testsDir,
    sqlDir,
    functionsDir,
    outputDir
  ) {
    if (projectRoot) this.projectRoot = projectRoot;
    if (supabaseDir) this.supabaseDir = supabaseDir;
    if (migrationsDir) this.migrationsDir = migrationsDir;
    if (testsDir) this.testsDir = testsDir;
    if (sqlDir) this.sqlDir = sqlDir;
    if (functionsDir) this.functionsDir = functionsDir;
    if (outputDir) this.buildDir = outputDir;
  }

  _resolveAllPaths() {
    const pathProps = [
      'projectRoot', 'supabaseDir', 'migrationsDir', 'testsDir',
      'sqlDir', 'functionsDir', 'seedDir', 'supabaseConfig',
      'dataConfig', 'buildDir', 'cacheDir', 'tempDir',
      'logFile', 'errorLogFile'
    ];
    
    for (const prop of pathProps) {
      if (this[prop] && typeof this[prop] === 'string' && !path.isAbsolute(this[prop])) {
        this[prop] = path.resolve(this[prop]);
      }
    }
  }

  _validatePaths() {
    const createIfMissing = [
      this.buildDir,
      this.cacheDir,
      this.tempDir,
      this.migrationsDir
    ];
    
    for (const dir of createIfMissing) {
      if (dir && !fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch {
          // Silent - directories will be created when needed
        }
      }
    }
  }

  exists(pathProperty) {
    const value = this[pathProperty];
    return value && fs.existsSync(value);
  }

  getRelative(pathProperty) {
    const value = this[pathProperty];
    return value ? path.relative(process.cwd(), value) : null;
  }

  debug() {
    console.log('\nOutputConfig Paths:');
    console.log('═'.repeat(60));
    
    const categories = {
      'Core': ['projectRoot', 'supabaseDir'],
      'Supabase': ['migrationsDir', 'testsDir', 'sqlDir', 'functionsDir', 'seedDir'],
      'Config': ['supabaseConfig', 'dataConfig'],
      'Output': ['buildDir', 'cacheDir', 'tempDir'],
      'Logs': ['logFile', 'errorLogFile']
    };
    
    for (const [category, props] of Object.entries(categories)) {
      console.log(`\n${category}:`);
      for (const prop of props) {
        const value = this[prop];
        const exists = value && fs.existsSync(value);
        const mark = exists ? '✓' : '✗';
        const display = this.getRelative(prop) || value || '(not set)';
        console.log(`  ${mark} ${prop}: ${display}`);
      }
    }
    
    console.log('\n' + '═'.repeat(60) + '\n');
  }
}

module.exports = OutputConfig;