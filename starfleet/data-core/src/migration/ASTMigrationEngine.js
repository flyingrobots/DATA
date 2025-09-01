import { parse } from 'pgsql-parser';
import { EventEmitter } from 'events';

/**
 * Represents a single migration operation
 * @typedef {Object} MigrationOperation
 * @property {'SAFE'|'DESTRUCTIVE'|'WARNING'} type - Safety level
 * @property {string} sql - The SQL statement to execute
 * @property {string} [description] - Human-readable description
 * @property {string} [warning] - Warning message for dangerous operations
 * @property {boolean} [requiresConfirmation] - Whether user must confirm
 */

/**
 * Schema object representation
 * @typedef {Object} SchemaObject
 * @property {Map<string, Object>} tables
 * @property {Map<string, Object>} functions
 * @property {Map<string, Object>} triggers
 * @property {Map<string, Object>} policies
 * @property {Map<string, Object>} enums
 * @property {Map<string, Object>} indexes
 * @property {Map<string, Object>} views
 */

class ASTMigrationEngine extends EventEmitter {
  constructor() {
    super();

    // Destructive operation patterns
    this.DESTRUCTIVE_PATTERNS = [
      'DROP TABLE',
      'DROP COLUMN',
      'DROP CONSTRAINT',
      'DELETE FROM',
      'TRUNCATE',
      'DROP INDEX',
      'DROP FUNCTION',
      'DROP TRIGGER',
      'DROP POLICY',
      'DROP TYPE',
      'ALTER COLUMN.*DROP DEFAULT',
      'ALTER COLUMN.*DROP NOT NULL'
    ];

    // Supabase-specific object patterns
    this.SUPABASE_PATTERNS = {
      storage: /storage\.(buckets|objects)/i,
      auth: /auth\.(users|refresh_tokens|audit_log_entries)/i,
      realtime: /realtime\.(subscription)/i,
      rls: /CREATE POLICY|ALTER POLICY|DROP POLICY/i
    };
  }

  /**
   * Generate migration from two SQL states using AST comparison
   * @param {string} fromSQL - SQL at previous deployment (from git tag)
   * @param {string} toSQL - Current SQL (from HEAD)
   * @returns {Promise<MigrationOperation[]>} Array of migration operations
   */
  async generateMigration(fromSQL, toSQL) {
    this.emit('start', { message: 'Parsing SQL into AST...' });

    try {
      // Parse both SQL states into AST
      const fromSchema = await this.parseSchema(fromSQL);
      const toSchema = await this.parseSchema(toSQL);

      this.emit('progress', {
        message: 'Analyzing schema differences...',
        fromObjects: this.countObjects(fromSchema),
        toObjects: this.countObjects(toSchema)
      });

      // Generate migrations for each object type
      const migrations = [];

      // Tables (most complex - includes columns, constraints)
      migrations.push(...(await this.diffTables(fromSchema.tables, toSchema.tables)));

      // Functions and Triggers
      migrations.push(...(await this.diffFunctions(fromSchema.functions, toSchema.functions)));
      migrations.push(...(await this.diffTriggers(fromSchema.triggers, toSchema.triggers)));

      // RLS Policies (Supabase critical)
      migrations.push(...(await this.diffPolicies(fromSchema.policies, toSchema.policies)));

      // Enums and Custom Types
      migrations.push(...(await this.diffEnums(fromSchema.enums, toSchema.enums)));

      // Indexes
      migrations.push(...(await this.diffIndexes(fromSchema.indexes, toSchema.indexes)));

      // Views
      migrations.push(...(await this.diffViews(fromSchema.views, toSchema.views)));

      // Detect destructive operations
      const destructive = migrations.filter(m => m.type === 'DESTRUCTIVE');
      if (destructive.length > 0) {
        this.emit('warning', {
          message: `${destructive.length} destructive operations detected`,
          operations: destructive
        });
      }

      this.emit('complete', {
        message: 'Migration generation complete',
        totalOperations: migrations.length,
        destructiveCount: destructive.length
      });

      return migrations;
    } catch (error) {
      this.emit('error', {
        message: 'Failed to generate migration',
        error
      });
      throw error;
    }
  }

  /**
   * Parse SQL into structured schema representation
   * @param {string} sql - SQL to parse
   * @returns {Promise<SchemaObject>} Structured schema
   */
  async parseSchema(sql) {
    const schema = {
      tables: new Map(),
      functions: new Map(),
      triggers: new Map(),
      policies: new Map(),
      enums: new Map(),
      indexes: new Map(),
      views: new Map(),
      extensions: new Map(),
      grants: new Map()
    };

    try {
      const ast = parse(sql);

      for (const statement of ast) {
        const stmt = statement.RawStmt?.stmt;
        if (!stmt) continue;

        switch (stmt.CreateStmt ? 'CreateStmt' :
          stmt.AlterTableStmt ? 'AlterTableStmt' :
            stmt.CreateFunctionStmt ? 'CreateFunctionStmt' :
              stmt.CreateTrigStmt ? 'CreateTrigStmt' :
                stmt.CreatePolicyStmt ? 'CreatePolicyStmt' :
                  stmt.CreateEnumStmt ? 'CreateEnumStmt' :
                    stmt.IndexStmt ? 'IndexStmt' :
                      stmt.ViewStmt ? 'ViewStmt' : null) {

        case 'CreateStmt':
          this.parseTable(stmt.CreateStmt, schema.tables);
          break;

        case 'CreateFunctionStmt':
          this.parseFunction(stmt.CreateFunctionStmt, schema.functions);
          break;

        case 'CreateTrigStmt':
          this.parseTrigger(stmt.CreateTrigStmt, schema.triggers);
          break;

        case 'CreatePolicyStmt':
          this.parsePolicy(stmt.CreatePolicyStmt, schema.policies);
          break;

        case 'CreateEnumStmt':
          this.parseEnum(stmt.CreateEnumStmt, schema.enums);
          break;

        case 'IndexStmt':
          this.parseIndex(stmt.IndexStmt, schema.indexes);
          break;

        case 'ViewStmt':
          this.parseView(stmt.ViewStmt, schema.views);
          break;
        }
      }
    } catch (error) {
      // Some SQL might not parse perfectly, log but continue
      this.emit('warning', {
        message: 'Some SQL statements could not be parsed',
        error: error.message
      });
    }

    return schema;
  }

  /**
   * Compare tables and generate ALTER TABLE statements
   */
  async diffTables(fromTables, toTables) {
    const migrations = [];

    // New tables
    for (const [name, table] of toTables) {
      if (!fromTables.has(name)) {
        migrations.push({
          type: 'SAFE',
          sql: this.reconstructCreateTable(table),
          description: `Create new table: ${name}`
        });
      }
    }

    // Dropped tables (DESTRUCTIVE!)
    for (const [name, table] of fromTables) {
      if (!toTables.has(name)) {
        migrations.push({
          type: 'DESTRUCTIVE',
          sql: `DROP TABLE IF EXISTS ${name} CASCADE`,
          description: `Drop table: ${name}`,
          warning: `THIS WILL DELETE ALL DATA IN TABLE ${name}`,
          requiresConfirmation: true
        });
      }
    }

    // Modified tables (column changes)
    for (const [name, toTable] of toTables) {
      if (fromTables.has(name)) {
        const fromTable = fromTables.get(name);
        migrations.push(...this.diffTableColumns(name, fromTable, toTable));
      }
    }

    return migrations;
  }

  /**
   * Compare table columns and generate ALTER TABLE statements
   */
  diffTableColumns(tableName, fromTable, toTable) {
    const migrations = [];
    const fromColumns = new Map(fromTable.columns?.map(c => [c.name, c]) || []);
    const toColumns = new Map(toTable.columns?.map(c => [c.name, c]) || []);

    // Added columns (SAFE)
    for (const [colName, col] of toColumns) {
      if (!fromColumns.has(colName)) {
        migrations.push({
          type: 'SAFE',
          sql: `ALTER TABLE ${tableName} ADD COLUMN ${this.reconstructColumn(col)}`,
          description: `Add column ${tableName}.${colName}`
        });
      }
    }

    // Dropped columns (DESTRUCTIVE!)
    for (const [colName, col] of fromColumns) {
      if (!toColumns.has(colName)) {
        migrations.push({
          type: 'DESTRUCTIVE',
          sql: `ALTER TABLE ${tableName} DROP COLUMN ${colName}`,
          description: `Drop column ${tableName}.${colName}`,
          warning: `THIS WILL DELETE ALL DATA IN COLUMN ${tableName}.${colName}`,
          requiresConfirmation: true
        });
      }
    }

    // Modified columns (check type, nullable, default)
    for (const [colName, toCol] of toColumns) {
      if (fromColumns.has(colName)) {
        const fromCol = fromColumns.get(colName);

        // Type change (potentially DESTRUCTIVE)
        if (this.columnTypesDiffer(fromCol, toCol)) {
          migrations.push({
            type: 'WARNING',
            sql: `ALTER TABLE ${tableName} ALTER COLUMN ${colName} TYPE ${toCol.type}`,
            description: `Change type of ${tableName}.${colName}`,
            warning: 'Type change may result in data loss or errors'
          });
        }

        // Nullable change
        if (fromCol.nullable !== toCol.nullable) {
          if (toCol.nullable) {
            migrations.push({
              type: 'SAFE',
              sql: `ALTER TABLE ${tableName} ALTER COLUMN ${colName} DROP NOT NULL`,
              description: `Make ${tableName}.${colName} nullable`
            });
          } else {
            migrations.push({
              type: 'WARNING',
              sql: `ALTER TABLE ${tableName} ALTER COLUMN ${colName} SET NOT NULL`,
              description: `Make ${tableName}.${colName} required`,
              warning: 'Will fail if column contains NULL values'
            });
          }
        }

        // Default value change
        if (this.defaultsDiffer(fromCol.default, toCol.default)) {
          if (toCol.default) {
            migrations.push({
              type: 'SAFE',
              sql: `ALTER TABLE ${tableName} ALTER COLUMN ${colName} SET DEFAULT ${toCol.default}`,
              description: `Set default for ${tableName}.${colName}`
            });
          } else {
            migrations.push({
              type: 'SAFE',
              sql: `ALTER TABLE ${tableName} ALTER COLUMN ${colName} DROP DEFAULT`,
              description: `Remove default from ${tableName}.${colName}`
            });
          }
        }
      }
    }

    return migrations;
  }

  /**
   * Compare RLS policies (critical for Supabase)
   */
  async diffPolicies(fromPolicies, toPolicies) {
    const migrations = [];

    // New policies
    for (const [key, policy] of toPolicies) {
      if (!fromPolicies.has(key)) {
        migrations.push({
          type: 'SAFE',
          sql: this.reconstructPolicy(policy),
          description: `Create RLS policy: ${policy.name} on ${policy.table}`
        });
      }
    }

    // Dropped policies
    for (const [key, policy] of fromPolicies) {
      if (!toPolicies.has(key)) {
        migrations.push({
          type: 'WARNING',
          sql: `DROP POLICY IF EXISTS ${policy.name} ON ${policy.table}`,
          description: `Drop RLS policy: ${policy.name}`,
          warning: 'Removing security policy - ensure this is intentional'
        });
      }
    }

    // Modified policies (drop and recreate)
    for (const [key, toPolicy] of toPolicies) {
      if (fromPolicies.has(key)) {
        const fromPolicy = fromPolicies.get(key);
        if (this.policiesDiffer(fromPolicy, toPolicy)) {
          migrations.push({
            type: 'WARNING',
            sql: `DROP POLICY IF EXISTS ${fromPolicy.name} ON ${fromPolicy.table};\n${this.reconstructPolicy(toPolicy)}`,
            description: `Recreate RLS policy: ${toPolicy.name}`,
            warning: 'Policy will be briefly removed during migration'
          });
        }
      }
    }

    return migrations;
  }

  /**
   * Compare functions
   */
  async diffFunctions(fromFunctions, toFunctions) {
    const migrations = [];

    for (const [signature, toFunc] of toFunctions) {
      if (!fromFunctions.has(signature)) {
        // New function
        migrations.push({
          type: 'SAFE',
          sql: this.reconstructFunction(toFunc),
          description: `Create function: ${signature}`
        });
      } else {
        // Check if function body changed
        const fromFunc = fromFunctions.get(signature);
        if (fromFunc.body !== toFunc.body) {
          migrations.push({
            type: 'SAFE',
            sql: `CREATE OR REPLACE FUNCTION ${this.reconstructFunction(toFunc)}`,
            description: `Update function: ${signature}`
          });
        }
      }
    }

    // Dropped functions
    for (const [signature, func] of fromFunctions) {
      if (!toFunctions.has(signature)) {
        migrations.push({
          type: 'WARNING',
          sql: `DROP FUNCTION IF EXISTS ${signature} CASCADE`,
          description: `Drop function: ${signature}`,
          warning: 'May break dependent objects'
        });
      }
    }

    return migrations;
  }

  /**
   * Helper methods for reconstruction and comparison
   */

  reconstructColumn(col) {
    let sql = `${col.name} ${col.type}`;
    if (col.default) sql += ` DEFAULT ${col.default}`;
    if (!col.nullable) sql += ' NOT NULL';
    if (col.unique) sql += ' UNIQUE';
    return sql;
  }

  reconstructCreateTable(table) {
    const columns = table.columns.map(c => this.reconstructColumn(c));
    return `CREATE TABLE ${table.name} (\n  ${columns.join(',\n  ')}\n)`;
  }

  reconstructPolicy(policy) {
    return `CREATE POLICY ${policy.name} ON ${policy.table}
      FOR ${policy.command || 'ALL'}
      TO ${policy.role || 'public'}
      ${policy.permissive ? 'AS PERMISSIVE' : 'AS RESTRICTIVE'}
      ${policy.using ? `USING (${policy.using})` : ''}
      ${policy.check ? `WITH CHECK (${policy.check})` : ''}`;
  }

  reconstructFunction(func) {
    return `${func.name}(${func.arguments || ''})
      RETURNS ${func.returnType}
      LANGUAGE ${func.language}
      ${func.volatility || ''}
      AS $$${func.body}$$`;
  }

  columnTypesDiffer(col1, col2) {
    // Normalize types for comparison
    const normalize = (type) => type?.toLowerCase().replace(/\s+/g, '');
    return normalize(col1.type) !== normalize(col2.type);
  }

  defaultsDiffer(def1, def2) {
    // Handle various default formats
    const normalize = (def) => def?.toString().replace(/['"]/g, '').trim();
    return normalize(def1) !== normalize(def2);
  }

  policiesDiffer(pol1, pol2) {
    return pol1.using !== pol2.using ||
           pol1.check !== pol2.check ||
           pol1.command !== pol2.command ||
           pol1.role !== pol2.role;
  }

  countObjects(schema) {
    return {
      tables: schema.tables.size,
      functions: schema.functions.size,
      policies: schema.policies.size,
      triggers: schema.triggers.size,
      indexes: schema.indexes.size,
      enums: schema.enums.size,
      views: schema.views.size
    };
  }

  /**
   * Parse individual object types from AST
   */

  parseTable(stmt, tables) {
    const tableName = stmt.relation?.relname;
    if (!tableName) return;

    const columns = stmt.tableElts?.map(elt => {
      if (elt.ColumnDef) {
        return {
          name: elt.ColumnDef.colname,
          type: this.extractType(elt.ColumnDef.typeName),
          nullable: !elt.ColumnDef.is_not_null,
          default: elt.ColumnDef.raw_default,
          constraints: elt.ColumnDef.constraints
        };
      }
    }).filter(Boolean) || [];

    tables.set(tableName, {
      name: tableName,
      columns,
      raw: stmt
    });
  }

  parseFunction(stmt, functions) {
    const funcName = stmt.funcname?.[0]?.String?.str;
    if (!funcName) return;

    // Build signature
    const args = stmt.parameters?.map(p => `${p.name} ${p.type}`).join(', ') || '';
    const signature = `${funcName}(${args})`;

    functions.set(signature, {
      name: funcName,
      signature,
      arguments: args,
      returnType: this.extractType(stmt.returnType),
      language: stmt.language,
      body: stmt.as?.[0] || stmt.sql_body,
      raw: stmt
    });
  }

  parsePolicy(stmt, policies) {
    const policyName = stmt.policy_name;
    const tableName = stmt.table?.relname;
    if (!policyName || !tableName) return;

    const key = `${tableName}.${policyName}`;
    policies.set(key, {
      name: policyName,
      table: tableName,
      command: stmt.cmd,
      role: stmt.roles,
      permissive: stmt.permissive,
      using: stmt.qual,
      check: stmt.with_check,
      raw: stmt
    });
  }

  parseEnum(stmt, enums) {
    const typeName = stmt.typeName?.[0]?.String?.str;
    if (!typeName) return;

    const values = stmt.vals?.map(v => v.String?.str).filter(Boolean) || [];

    enums.set(typeName, {
      name: typeName,
      values,
      raw: stmt
    });
  }

  parseIndex(stmt, indexes) {
    const indexName = stmt.idxname;
    const tableName = stmt.relation?.relname;
    if (!indexName) return;

    indexes.set(indexName, {
      name: indexName,
      table: tableName,
      unique: stmt.unique,
      columns: stmt.indexParams,
      raw: stmt
    });
  }

  parseTrigger(stmt, triggers) {
    const triggerName = stmt.trigname;
    const tableName = stmt.relation?.relname;
    if (!triggerName) return;

    triggers.set(triggerName, {
      name: triggerName,
      table: tableName,
      timing: stmt.timing,
      events: stmt.events,
      function: stmt.funcname,
      raw: stmt
    });
  }

  parseView(stmt, views) {
    const viewName = stmt.view?.relname;
    if (!viewName) return;

    views.set(viewName, {
      name: viewName,
      query: stmt.query,
      raw: stmt
    });
  }

  extractType(typeName) {
    if (!typeName) return 'unknown';
    if (typeName.String) return typeName.String.str;
    if (typeName.names) return typeName.names.map(n => n.String?.str).join('.');
    return 'unknown';
  }

  /**
   * Additional diff methods
   */

  async diffEnums(fromEnums, toEnums) {
    const migrations = [];

    // New enums
    for (const [name, enumDef] of toEnums) {
      if (!fromEnums.has(name)) {
        migrations.push({
          type: 'SAFE',
          sql: `CREATE TYPE ${name} AS ENUM (${enumDef.values.map(v => `'${v}'`).join(', ')})`,
          description: `Create enum type: ${name}`
        });
      }
    }

    // Modified enums (can only ADD values, not remove)
    for (const [name, toEnum] of toEnums) {
      if (fromEnums.has(name)) {
        const fromEnum = fromEnums.get(name);
        const newValues = toEnum.values.filter(v => !fromEnum.values.includes(v));

        for (const value of newValues) {
          migrations.push({
            type: 'SAFE',
            sql: `ALTER TYPE ${name} ADD VALUE '${value}'`,
            description: `Add value '${value}' to enum ${name}`
          });
        }

        // Check for removed values (PROBLEM!)
        const removedValues = fromEnum.values.filter(v => !toEnum.values.includes(v));
        if (removedValues.length > 0) {
          migrations.push({
            type: 'DESTRUCTIVE',
            sql: `-- MANUAL INTERVENTION REQUIRED: Cannot remove enum values ${removedValues.join(', ')} from ${name}`,
            description: `Cannot remove enum values from ${name}`,
            warning: 'PostgreSQL does not support removing enum values. Manual data migration required.',
            requiresConfirmation: true
          });
        }
      }
    }

    return migrations;
  }

  async diffIndexes(fromIndexes, toIndexes) {
    const migrations = [];

    // New indexes
    for (const [name, index] of toIndexes) {
      if (!fromIndexes.has(name)) {
        migrations.push({
          type: 'SAFE',
          sql: `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${name} ON ${index.table} (${index.columns})`,
          description: `Create index: ${name}`
        });
      }
    }

    // Dropped indexes
    for (const [name, index] of fromIndexes) {
      if (!toIndexes.has(name)) {
        migrations.push({
          type: 'WARNING',
          sql: `DROP INDEX IF EXISTS ${name}`,
          description: `Drop index: ${name}`,
          warning: 'May impact query performance'
        });
      }
    }

    return migrations;
  }

  async diffTriggers(fromTriggers, toTriggers) {
    const migrations = [];

    // For triggers, we'll drop and recreate if changed
    for (const [name, toTrigger] of toTriggers) {
      if (!fromTriggers.has(name)) {
        migrations.push({
          type: 'SAFE',
          sql: this.reconstructTrigger(toTrigger),
          description: `Create trigger: ${name}`
        });
      } else {
        const fromTrigger = fromTriggers.get(name);
        if (this.triggersDiffer(fromTrigger, toTrigger)) {
          migrations.push({
            type: 'WARNING',
            sql: `DROP TRIGGER IF EXISTS ${name} ON ${fromTrigger.table};\n${this.reconstructTrigger(toTrigger)}`,
            description: `Recreate trigger: ${name}`,
            warning: 'Trigger will be briefly removed during migration'
          });
        }
      }
    }

    // Dropped triggers
    for (const [name, trigger] of fromTriggers) {
      if (!toTriggers.has(name)) {
        migrations.push({
          type: 'WARNING',
          sql: `DROP TRIGGER IF EXISTS ${name} ON ${trigger.table}`,
          description: `Drop trigger: ${name}`
        });
      }
    }

    return migrations;
  }

  async diffViews(fromViews, toViews) {
    const migrations = [];

    // Views are typically dropped and recreated
    for (const [name, toView] of toViews) {
      if (!fromViews.has(name)) {
        migrations.push({
          type: 'SAFE',
          sql: `CREATE VIEW ${name} AS ${toView.query}`,
          description: `Create view: ${name}`
        });
      } else {
        const fromView = fromViews.get(name);
        if (fromView.query !== toView.query) {
          migrations.push({
            type: 'SAFE',
            sql: `CREATE OR REPLACE VIEW ${name} AS ${toView.query}`,
            description: `Update view: ${name}`
          });
        }
      }
    }

    // Dropped views
    for (const [name, view] of fromViews) {
      if (!toViews.has(name)) {
        migrations.push({
          type: 'WARNING',
          sql: `DROP VIEW IF EXISTS ${name} CASCADE`,
          description: `Drop view: ${name}`,
          warning: 'May break dependent objects'
        });
      }
    }

    return migrations;
  }

  reconstructTrigger(trigger) {
    return `CREATE TRIGGER ${trigger.name}
      ${trigger.timing} ${trigger.events}
      ON ${trigger.table}
      FOR EACH ROW
      EXECUTE FUNCTION ${trigger.function}()`;
  }

  triggersDiffer(t1, t2) {
    return t1.timing !== t2.timing ||
           t1.events !== t2.events ||
           t1.function !== t2.function;
  }
}

export default ASTMigrationEngine;
