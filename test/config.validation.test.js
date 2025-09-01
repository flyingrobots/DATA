import { describe, it, expect } from 'vitest';
import {
  DataConfigSchema,
  parsedataConfig,
  safeParsedataConfig,
  mergeConfigs
} from '../src/lib/schemas/DataConfigSchema.js';

describe('dataConfigSchema', () => {
  describe('parsedataConfig', () => {
    it('should accept valid minimal config', () => {
      const config = {
        environments: {
          local: {
            db: 'postgresql://localhost/test'
          }
        }
      };

      expect(() => parsedataConfig(config)).not.toThrow();
    });

    it('should accept empty config with defaults', () => {
      const config = {};
      expect(() => parsedataConfig(config)).not.toThrow();
    });

    it('should reject invalid database URL', () => {
      const config = {
        environments: {
          local: {
            db: 'not-a-postgresql-url'
          }
        }
      };

      expect(() => parsedataConfig(config)).toThrow();
    });

    it('should reject invalid environment names', () => {
      const config = {
        environments: {
          '123invalid': {
            db: 'postgresql://localhost/test'
          }
        }
      };

      expect(() => parsedataConfig(config)).toThrow();
    });

    it('should accept complete valid config', () => {
      const config = {
        test: {
          minimum_coverage: 90,
          test_timeout: 600,
          output_formats: ['console', 'json', 'junit'],
          parallel: true,
          verbose: true
        },
        environments: {
          local: {
            db: 'postgresql://localhost/test',
            supabase_url: 'https://example.supabase.co',
            supabase_anon_key: 'test-key',
            supabase_service_role_key: 'service-key'
          },
          staging: {
            db: 'postgresql://staging/test'
          }
        },
        paths: {
          sql_dir: './custom/sql',
          tests_dir: './custom/tests',
          migrations_dir: './custom/migrations',
          functions_dir: './custom/functions',
          schemas_dir: './custom/schemas'
        },
        compile: {
          auto_squash: true,
          include_comments: false,
          validate_syntax: true
        },
        migrate: {
          auto_rollback: false,
          dry_run: true,
          lock_timeout: 30,
          batch_size: 5
        },
        functions: {
          deploy_on_migrate: true,
          import_map: './custom/import_map.json',
          verify_jwt: false
        },
        safety: {
          require_prod_flag: false,
          require_confirmation: false,
          backup_before_migrate: true,
          max_affected_rows: 50000
        },
        logging: {
          level: 'debug',
          format: 'json',
          timestamps: false
        }
      };

      const parsed = parsedataConfig(config);
      expect(parsed).toMatchObject(config);
    });

    it('should allow $schema property', () => {
      const config = {
        $schema: './datarc.schema.json',
        environments: {
          local: {
            db: 'postgresql://localhost/test'
          }
        }
      };

      expect(() => parsedataConfig(config)).not.toThrow();
    });

    it('should reject unknown properties', () => {
      const config = {
        unknownProperty: 'value',
        environments: {
          local: {
            db: 'postgresql://localhost/test'
          }
        }
      };

      expect(() => parsedataConfig(config)).toThrow();
    });

    it('should validate coverage range', () => {
      const invalidConfig = {
        test: {
          minimum_coverage: 150
        }
      };

      expect(() => parsedataConfig(invalidConfig)).toThrow();

      const validConfig = {
        test: {
          minimum_coverage: 85
        }
      };

      expect(() => parsedataConfig(validConfig)).not.toThrow();
    });

    it('should validate output formats', () => {
      const invalidConfig = {
        test: {
          output_formats: ['console', 'invalid-format']
        }
      };

      expect(() => parsedataConfig(invalidConfig)).toThrow();

      const validConfig = {
        test: {
          output_formats: ['console', 'json', 'junit', 'tap', 'html']
        }
      };

      expect(() => parsedataConfig(validConfig)).not.toThrow();
    });

    it('should validate logging levels', () => {
      const invalidConfig = {
        logging: {
          level: 'invalid-level'
        }
      };

      expect(() => parsedataConfig(invalidConfig)).toThrow();

      const validConfig = {
        logging: {
          level: 'debug'
        }
      };

      expect(() => parsedataConfig(validConfig)).not.toThrow();
    });
  });

  describe('safeParsedataConfig', () => {
    it('should return success for valid config', () => {
      const config = {
        environments: {
          local: {
            db: 'postgresql://localhost/test'
          }
        }
      };

      const result = safeParsedataConfig(config);
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(config);
    });

    it('should return error for invalid config', () => {
      const config = {
        environments: {
          local: {
            db: 'invalid-url'
          }
        }
      };

      const result = safeParsedataConfig(config);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.errors).toHaveLength(1);
    });

    it('should provide detailed error information', () => {
      const config = {
        test: {
          minimum_coverage: 'not-a-number',
          test_timeout: -5
        },
        environments: {
          '': {
            db: 'not-a-url'
          }
        }
      };

      const result = safeParsedataConfig(config);
      expect(result.success).toBe(false);
      expect(result.error.errors.length).toBeGreaterThan(1);
    });
  });

  describe('mergeConfigs', () => {
    it('should merge base and override configs', () => {
      const base = {
        test: {
          minimum_coverage: 80,
          test_timeout: 300
        },
        environments: {
          local: {
            db: 'postgresql://localhost/base'
          }
        }
      };

      const override = {
        test: {
          minimum_coverage: 90
        },
        environments: {
          prod: {
            db: 'postgresql://prod/db'
          }
        }
      };

      const merged = mergeConfigs(base, override);
      expect(merged.test.minimum_coverage).toBe(90);
      expect(merged.test.test_timeout).toBe(300);
      expect(merged.environments.local).toBeDefined();
      expect(merged.environments.prod).toBeDefined();
    });

    it('should validate merged result', () => {
      const base = {
        test: {
          minimum_coverage: 80
        }
      };

      const override = {
        test: {
          minimum_coverage: 200 // Invalid
        }
      };

      expect(() => mergeConfigs(base, override)).toThrow();
    });

    it('should handle empty configs', () => {
      const base = {};
      const override = {};

      expect(() => mergeConfigs(base, override)).not.toThrow();
    });

    it('should override arrays completely', () => {
      const base = {
        test: {
          output_formats: ['console', 'json']
        }
      };

      const override = {
        test: {
          output_formats: ['junit']
        }
      };

      const merged = mergeConfigs(base, override);
      expect(merged.test.output_formats).toEqual(['junit']);
    });
  });
});
