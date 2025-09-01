import { z } from 'zod';

/**
 * Zod schema for data configuration validation
 * Matches the JSON Schema in datarc.schema.json
 */

// Test configuration schema
const TestConfigSchema = z.object({
  minimum_coverage: z.number().min(0).max(100).default(80).optional(),
  test_timeout: z.number().min(1).default(300).optional(),
  output_formats: z.array(
    z.enum(['console', 'junit', 'json', 'tap', 'html'])
  ).default(['console']).optional(),
  parallel: z.boolean().default(false).optional(),
  verbose: z.boolean().default(false).optional()
}).strict().optional();

// Environment configuration schema
const EnvironmentSchema = z.object({
  db: z.string().url().regex(/^postgresql:\/\/.*/, 'Must be a PostgreSQL URL'),
  supabase_url: z.string().url().optional(),
  supabase_anon_key: z.string().optional(),
  supabase_service_role_key: z.string().optional()
}).strict();

// Paths configuration schema
const PathsConfigSchema = z.object({
  sql_dir: z.string().default('./sql').optional(),
  tests_dir: z.string().default('./tests').optional(),
  migrations_dir: z.string().default('./migrations').optional(),
  functions_dir: z.string().default('./functions').optional(),
  schemas_dir: z.string().default('./schemas').optional()
}).strict().optional();

// Compile configuration schema
const CompileConfigSchema = z.object({
  auto_squash: z.boolean().default(false).optional(),
  include_comments: z.boolean().default(true).optional(),
  validate_syntax: z.boolean().default(true).optional()
}).strict().optional();

// Migration configuration schema
const MigrateConfigSchema = z.object({
  auto_rollback: z.boolean().default(true).optional(),
  dry_run: z.boolean().default(false).optional(),
  lock_timeout: z.number().min(1).default(10).optional(),
  batch_size: z.number().min(1).default(10).optional()
}).strict().optional();

// Functions configuration schema
const FunctionsConfigSchema = z.object({
  deploy_on_migrate: z.boolean().default(false).optional(),
  import_map: z.string().default('./import_map.json').optional(),
  verify_jwt: z.boolean().default(true).optional()
}).strict().optional();

// Safety configuration schema
const SafetyConfigSchema = z.object({
  require_prod_flag: z.boolean().default(true).optional(),
  require_confirmation: z.boolean().default(true).optional(),
  backup_before_migrate: z.boolean().default(true).optional(),
  max_affected_rows: z.number().min(0).default(10000).optional()
}).strict().optional();

// Logging configuration schema
const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info').optional(),
  format: z.enum(['text', 'json']).default('text').optional(),
  timestamps: z.boolean().default(true).optional()
}).strict().optional();

// Main data configuration schema
const DataConfigSchema = z.object({
  $schema: z.string().optional(), // Allow but don't require the schema reference
  test: TestConfigSchema,
  environments: z.record(
    z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Environment name must start with a letter'),
    EnvironmentSchema
  ).optional(),
  paths: PathsConfigSchema,
  compile: CompileConfigSchema,
  migrate: MigrateConfigSchema,
  functions: FunctionsConfigSchema,
  safety: SafetyConfigSchema,
  logging: LoggingConfigSchema
}).strict();

/**
 * Parse and validate data configuration
 * @param {unknown} config - Raw configuration object
 * @returns {z.infer<typeof dataConfigSchema>} Validated configuration
 * @throws {z.ZodError} If validation fails
 */
function parsedataConfig(config) {
  return dataConfigSchema.parse(config);
}

/**
 * Safely parse data configuration (doesn't throw)
 * @param {unknown} config - Raw configuration object
 * @returns {{success: boolean, data?: z.infer<typeof dataConfigSchema>, error?: z.ZodError}}
 */
function safeParsedataConfig(config) {
  return dataConfigSchema.safeParse(config);
}

/**
 * Get default configuration
 * @returns {z.infer<typeof dataConfigSchema>}
 */
function getDefaultConfig() {
  return dataConfigSchema.parse({});
}

/**
 * Merge configurations with validation
 * @param {unknown} baseConfig - Base configuration
 * @param {unknown} overrides - Configuration overrides
 * @returns {z.infer<typeof dataConfigSchema>} Merged and validated configuration
 */
function mergeConfigs(baseConfig, overrides) {
  // Parse both configs to ensure they're valid
  const base = dataConfigSchema.parse(baseConfig || {});
  const over = dataConfigSchema.parse(overrides || {});

  // Deep merge the configurations
  const merged = {
    ...base,
    ...over,
    test: { ...base.test, ...over.test },
    environments: { ...base.environments, ...over.environments },
    paths: { ...base.paths, ...over.paths },
    compile: { ...base.compile, ...over.compile },
    migrate: { ...base.migrate, ...over.migrate },
    functions: { ...base.functions, ...over.functions },
    safety: { ...base.safety, ...over.safety },
    logging: { ...base.logging, ...over.logging }
  };

  // Validate the merged result
  return dataConfigSchema.parse(merged);
}

export {
  DataConfigSchema,
  parsedataConfig,
  safeParsedataConfig,
  getDefaultConfig,
  mergeConfigs,
  // Export individual schemas for targeted validation
  TestConfigSchema,
  EnvironmentSchema,
  PathsConfigSchema,
  CompileConfigSchema,
  MigrateConfigSchema,
  FunctionsConfigSchema,
  SafetyConfigSchema,
  LoggingConfigSchema
};
