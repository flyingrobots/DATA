/**
 * MigrationEvent - Migration event data structure
 * Pure data class - no dependencies
 */
export class MigrationEvent {
  /**
   * @param {string} type - Event type from EventTypes
   * @param {Object} data - Event data
   * @param {string} [data.migrationName] - Migration name
   * @param {number} [data.step] - Current step number
   * @param {number} [data.totalSteps] - Total steps
   * @param {string} [data.sqlFile] - SQL file being processed
   * @param {string} [data.preview] - Migration preview
   * @param {Date} [data.timestamp] - Event timestamp
   */
  constructor(type, data = {}) {
    this.type = type;
    this.data = data;
    this.timestamp = data.timestamp || new Date();
  }
}
