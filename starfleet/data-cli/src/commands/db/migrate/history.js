/**
 * Migration History Command
 */

import Command from '../../../lib/Command.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Show migration history and timeline
 */
/**
 * @class
 */
class MigrateHistoryCommand extends Command {
  static description = 'Show migration history';

  constructor(config = null, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Read-only operation
  }

  /**
   * Execute migration history display
   */
  async performExecute(args = {}) {
    this.emit('start');

    try {
      const limit = parseInt(args.limit || args.l || '20');
      const format = args.format || args.f || 'table';
      const filter = args.filter || args.action || null;

      this.progress('Loading migration history...');

      // Load history from file
      const history = await this.loadMigrationHistory();

      if (!history || history.length === 0) {
        this.warn('No migration history found');
        console.log('\n📋 No migration history available');
        console.log('Run some migration commands to start building history.\n');
        this.emit('complete', { count: 0 });
        return;
      }

      // Filter history if requested
      const filteredHistory = filter ?
        history.filter(entry => entry.action === filter) :
        history;

      // Limit results
      const limitedHistory = filteredHistory.slice(-limit).reverse();

      // Display history
      this.displayMigrationHistory(limitedHistory, format);

      this.emit('complete', {
        total: history.length,
        displayed: limitedHistory.length,
        filter
      });

    } catch (error) {
      this.error('Migration history display failed', error);
      this.emit('failed', { error });
      throw error;
    }
  }

  /**
   * Load migration history from file
   */
  async loadMigrationHistory() {
    try {
      const historyFile = path.resolve('supabase/.migration_history.json');
      const historyExists = await fs.access(historyFile).then(() => true).catch(() => false);

      if (!historyExists) {
        return [];
      }

      const historyContent = await fs.readFile(historyFile, 'utf8');
      return JSON.parse(historyContent);

    } catch (error) {
      this.warn('Could not load migration history', { error: error.message });
      return [];
    }
  }

  /**
   * Display migration history in requested format
   */
  displayMigrationHistory(history, format) {
    console.log('\n📋 Migration History');
    console.log('═══════════════════\n');

    if (format === 'json') {
      this.displayJsonFormat(history);
    } else if (format === 'timeline') {
      this.displayTimelineFormat(history);
    } else {
      this.displayTableFormat(history);
    }

    console.log('');
  }

  /**
   * Display history in table format
   */
  displayTableFormat(history) {
    if (history.length === 0) {
      console.log('No entries to display');
      return;
    }

    // Calculate column widths
    const maxAction = Math.max(6, ...history.map(h => h.action.length));
    const maxMigration = Math.max(9, ...history.map(h => (h.migration || '').length));
    const maxStatus = Math.max(6, ...history.map(h => (h.status || '').length));

    // Header
    console.log(
      'Action'.padEnd(maxAction) + ' │ ' +
      'Migration'.padEnd(maxMigration) + ' │ ' +
      'Status'.padEnd(maxStatus) + ' │ ' +
      'Timestamp'
    );

    console.log('─'.repeat(maxAction) + '─┼─' + '─'.repeat(maxMigration) + '─┼─' + '─'.repeat(maxStatus) + '─┼─' + '─'.repeat(19));

    // Rows
    history.forEach(entry => {
      const action = this.colorizeAction(entry.action);
      const migration = (entry.migration || '').padEnd(maxMigration);
      const status = this.colorizeStatus(entry.status || '').padEnd(maxStatus);
      const timestamp = new Date(entry.timestamp).toLocaleString();

      console.log(`${action.padEnd(maxAction)} │ ${migration} │ ${status} │ ${timestamp}`);
    });
  }

  /**
   * Display history in timeline format
   */
  displayTimelineFormat(history) {
    history.forEach((entry, index) => {
      const isLast = index === history.length - 1;
      const connector = isLast ? '└─' : '├─';
      const line = isLast ? '  ' : '│ ';

      const actionIcon = this.getActionIcon(entry.action);
      const statusColor = this.colorizeStatus(entry.status || 'unknown');

      console.log(`${connector} ${actionIcon} ${entry.action.toUpperCase()}: ${entry.migration || 'Unknown'}`);
      console.log(`${line}   Status: ${statusColor}`);
      console.log(`${line}   Time: ${new Date(entry.timestamp).toLocaleString()}`);

      if (entry.details) {
        console.log(`${line}   Details: ${entry.details}`);
      }

      if (!isLast) console.log('│');
    });
  }

  /**
   * Display history in JSON format
   */
  displayJsonFormat(history) {
    console.log(JSON.stringify(history, null, 2));
  }

  /**
   * Get icon for action type
   */
  getActionIcon(action) {
    const icons = {
      generate: '🔧',
      test: '🧪',
      promote: '🚀',
      rollback: '↩️',
      clean: '🧹',
      verify: '✅'
    };

    return icons[action] || '📝';
  }

  /**
   * Colorize action text (simplified - would use chalk in real implementation)
   */
  colorizeAction(action) {
    // In a real implementation, would use chalk or similar for colors
    const colors = {
      generate: action, // blue
      test: action,     // yellow
      promote: action,  // green
      rollback: action, // red
      clean: action,    // magenta
      verify: action    // cyan
    };

    return colors[action] || action;
  }

  /**
   * Colorize status text (simplified - would use chalk in real implementation)
   */
  colorizeStatus(status) {
    // In a real implementation, would use chalk or similar for colors
    const colors = {
      completed: status,  // green
      failed: status,     // red
      pending: status,    // yellow
      running: status     // blue
    };

    return colors[status] || status;
  }
}

/**
 * Migration history handler
 * @param {Object} args - Command arguments
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 * @param {boolean} isProd - Production flag
 * @returns {Promise<Object>} History result
 */
export default async function historyHandler(args, config, logger, isProd) {
  const command = new MigrateHistoryCommand(config, logger, isProd);
  return await command.performExecute(args);
}

export { MigrateHistoryCommand };
