/**
 * GenerateMigrationPlan - Pure use-case for generating migration plans
 * No I/O, no Node dependencies - only uses injected ports
 */
import { Events } from '../events/index.js';

/**
 * Factory for GenerateMigrationPlan use-case
 * @param {Object} deps - Dependencies
 * @param {import('../ports/FileSystemPort.js').FileSystemPort} deps.fs
 * @param {import('../ports/GlobPort.js').GlobPort} deps.glob
 * @param {import('../ports/CryptoPort.js').CryptoPort} deps.crypto
 * @param {import('../ports/LoggerPort.js').LoggerPort} deps.logger
 * @param {import('../ports/ClockPort.js').ClockPort} deps.clock
 * @param {import('../ports/EventBusPort.js').EventBusPort} deps.bus
 */
export function makeGenerateMigrationPlan(deps) {
  const { fs, glob, crypto, logger, clock, bus } = deps;

  return {
    /**
     * Execute migration plan generation
     * @param {Object} input
     * @param {string} input.sqlRoot - Root directory for SQL files
     * @param {string} [input.migrationName] - Optional migration name
     * @returns {Promise<{steps: Array, preview: string, checksum: string}>}
     */
    async execute({ sqlRoot, migrationName }) {
      bus.emit(Events.MIGRATION_PLAN_STARTED, { 
        at: clock.now(), 
        root: sqlRoot,
        name: migrationName 
      });

      // Find all SQL files
      const paths = await glob.find([`${sqlRoot}/**/*.sql`], { dot: false });
      logger.debug({ count: paths.length }, 'Found SQL files');

      const steps = [];
      const contents = [];

      // Process each SQL file
      for (const path of paths) {
        bus.emit(Events.MIGRATION_PLAN_STEP, { path });
        
        const sql = await fs.readFile(path);
        const id = crypto.hash(sql); // Stable content hash
        
        steps.push({ 
          id, 
          path, 
          sql,
          checksum: id
        });
        
        contents.push(`-- Source: ${path}\n-- Checksum: ${id}\n${sql}`);
      }

      // Generate deterministic preview
      const preview = contents.join('\n\n-- ===== Next File =====\n\n');
      const planChecksum = crypto.hash(preview);

      const plan = { 
        steps, 
        preview,
        checksum: planChecksum,
        timestamp: clock.nowMs(),
        name: migrationName || `migration_${clock.nowMs()}`
      };

      bus.emit(Events.MIGRATION_PLAN_READY, { 
        at: clock.now(), 
        count: steps.length,
        checksum: planChecksum 
      });

      return plan;
    }
  };
}