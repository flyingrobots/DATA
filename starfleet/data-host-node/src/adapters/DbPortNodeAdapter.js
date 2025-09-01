/**
 * DbPortNodeAdapter - Node.js PostgreSQL implementation of DbPort
 * Uses psql for migrations and pg_prove for tests
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';

const exec = promisify(execFile);

export class DbPortNodeAdapter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = null;
  }

  async _getPool() {
    if (!this.pool) {
      this.pool = new pg.Pool({
        connectionString: this.connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });
    }
    return this.pool;
  }

  async apply(sqlText) {
    // Use psql for migrations (better for DDL)
    const env = {
      ...process.env,
      DATABASE_URL: this.connectionString
    };

    await exec('psql', ['--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-c', sqlText], { env });
  }

  async query(sqlText, params = []) {
    const pool = await this._getPool();
    const result = await pool.query(sqlText, params);
    return result.rows;
  }

  async runPgTap(paths) {
    try {
      // Run pg_prove or custom pgTAP runner
      const { stdout } = await exec(
        'pg_prove',
        ['--verbose', '--formatter', 'TAP::Formatter::Console', ...paths],
        {
          env: {
            ...process.env,
            DATABASE_URL: this.connectionString
          }
        }
      );

      // Parse TAP output
      const lines = stdout.split('\n');
      let passed = 0;
      let failed = 0;
      const failures = [];

      for (const line of lines) {
        if (line.includes('ok ')) passed++;
        if (line.includes('not ok ')) {
          failed++;
          failures.push(line);
        }
      }

      return {
        passed,
        failed,
        total: passed + failed,
        failures
      };
    } catch (error) {
      // Fallback: run tests directly via psql
      return this._runPgTapViaPsql(paths);
    }
  }

  async _runPgTapViaPsql(paths) {
    // Implementation for running pgTAP tests via psql
    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const path of paths) {
      try {
        const { stdout } = await exec('psql', ['--no-psqlrc', '-tA', '-f', path], {
          env: {
            ...process.env,
            DATABASE_URL: this.connectionString
          }
        });

        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.startsWith('ok ')) passed++;
          if (line.startsWith('not ok ')) {
            failed++;
            failures.push(line);
          }
        }
      } catch (error) {
        failed++;
        failures.push(`Error running ${path}: ${error.message}`);
      }
    }

    return {
      passed,
      failed,
      total: passed + failed,
      failures
    };
  }

  async withTransaction(fn) {
    const pool = await this._getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const txApi = {
        apply: (sql) => client.query(sql).then(() => undefined),
        query: (sql, params) => client.query(sql, params).then((r) => r.rows)
      };

      const result = await fn(txApi);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Log rollback error but throw original
        console.error('Rollback failed:', rollbackError);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
