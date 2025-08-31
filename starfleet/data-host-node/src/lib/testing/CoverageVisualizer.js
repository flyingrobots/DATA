/**
 * CoverageVisualizer - CLI visualization for test coverage status
 * 
 * Creates ASCII-based visualizations with Star Trek LCARS-style theming
 * for terminal output of coverage data, gaps, and progress indicators.
 */

const chalk = require('chalk');

/**
 * @typedef {Object} CoverageData
 * @property {number} percentage - Overall coverage percentage (0-100)
 * @property {Object.<string, number>} categories - Coverage by category
 * @property {number} covered - Number of covered items
 * @property {number} total - Total number of items
 */

/**
 * @typedef {Object} CoverageGap
 * @property {string} type - Type of gap (table, function, etc.)
 * @property {string} name - Name of uncovered item
 * @property {string} category - Category classification
 * @property {string} [reason] - Optional reason for gap
 */

/**
 * @typedef {Object} MatrixData
 * @property {string[]} rows - Row labels (e.g., table names)
 * @property {string[]} columns - Column labels (e.g., test types)
 * @property {boolean[][]} matrix - 2D array of coverage status
 */

/**
 * Coverage visualization utility with LCARS-style terminal output
 */
class CoverageVisualizer {
  constructor() {
    // LCARS color scheme
    this.colors = {
      // Primary LCARS colors
      orange: chalk.rgb(255, 153, 0),      // LCARS Orange
      blue: chalk.rgb(153, 204, 255),      // LCARS Light Blue
      purple: chalk.rgb(204, 153, 255),    // LCARS Purple
      red: chalk.rgb(255, 102, 102),       // LCARS Red
      
      // Coverage status colors
      covered: chalk.green,
      uncovered: chalk.red,
      warning: chalk.yellow,
      
      // UI elements
      frame: chalk.rgb(0, 153, 255),       // Frame blue
      accent: chalk.rgb(255, 204, 0),      // Accent yellow
      text: chalk.white,
      dim: chalk.gray
    };
    
    // LCARS-style box drawing characters
    this.chars = {
      horizontal: '═',
      vertical: '║',
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      cross: '╬',
      teeDown: '╦',
      teeUp: '╩',
      teeLeft: '╣',
      teeRight: '╠',
      
      // Progress bar characters
      filled: '█',
      empty: '░',
      partial: '▓',
      
      // Matrix characters
      covered: '●',
      uncovered: '○',
      partial: '◐'
    };
  }
  
  /**
   * Display comprehensive coverage status
   * @param {CoverageData} coverage - Coverage data
   * @param {CoverageGap[]} gaps - Coverage gaps
   */
  displayCoverage(coverage, gaps) {
    this._displayHeader();
    this._displayOverallStatus(coverage);
    this._displayCategoryBreakdown(coverage.categories);
    
    if (gaps && gaps.length > 0) {
      this._displayGaps(gaps);
    }
    
    this._displaySummary(coverage, gaps);
    this._displayFooter();
  }
  
  /**
   * Create and display a coverage matrix visualization
   * @param {MatrixData} data - Matrix data structure
   */
  formatMatrix(data) {
    console.log(this.colors.frame('\n╔══ COVERAGE MATRIX ══════════════════════════════════════╗'));
    
    if (!data.rows || !data.columns || !data.matrix) {
      console.log(this.colors.red('   Invalid matrix data provided'));
      console.log(this.colors.frame('╚═════════════════════════════════════════════════════════╝\n'));
      return;
    }
    
    // Calculate column widths
    const maxRowNameLength = Math.max(...data.rows.map(r => r.length), 8);
    const colWidth = Math.max(3, Math.max(...data.columns.map(c => c.length)));
    
    // Header row with column names
    const headerSpacing = ' '.repeat(maxRowNameLength + 2);
    const headerRow = headerSpacing + data.columns
      .map(col => this.colors.blue(col.padEnd(colWidth)))
      .join(' ');
    console.log('║ ' + headerRow + ' ║');
    
    // Separator line
    const separatorLine = '║ ' + '─'.repeat(maxRowNameLength) + '─┼─' + 
      data.columns.map(() => '─'.repeat(colWidth)).join('─┼─') + ' ║';
    console.log(this.colors.frame(separatorLine));
    
    // Data rows
    data.matrix.forEach((row, rowIndex) => {
      const rowName = data.rows[rowIndex].padEnd(maxRowNameLength);
      const cells = row.map((covered, colIndex) => {
        const char = covered ? this.chars.covered : this.chars.uncovered;
        const color = covered ? this.colors.covered : this.colors.uncovered;
        return color(char.padEnd(colWidth));
      }).join(' ');
      
      console.log('║ ' + this.colors.text(rowName) + ' │ ' + cells + ' ║');
    });
    
    // Legend
    console.log(this.colors.frame('╠═══════════════════════════════════════════════════════════╣'));
    console.log('║ ' + this.colors.covered(this.chars.covered) + ' Covered   ' + 
                this.colors.uncovered(this.chars.uncovered) + ' Not Covered' + 
                ' '.repeat(39) + ' ║');
    console.log(this.colors.frame('╚═════════════════════════════════════════════════════════════╝\n'));
  }
  
  /**
   * Display progress indicator during analysis
   * @param {number} current - Current progress
   * @param {number} total - Total items to process
   * @param {string} [operation] - Description of current operation
   */
  showProgress(current, total, operation = 'Analyzing') {
    const percentage = Math.round((current / total) * 100);
    const barWidth = 30;
    const filledWidth = Math.round((current / total) * barWidth);
    
    // Create progress bar
    const filled = this.chars.filled.repeat(filledWidth);
    const empty = this.chars.empty.repeat(barWidth - filledWidth);
    const bar = this.colors.blue(filled) + this.colors.dim(empty);
    
    // Progress line with LCARS styling
    const progressLine = 
      this.colors.orange('█ ') + 
      this.colors.text(operation) + ': [' + bar + '] ' +
      this.colors.accent(`${percentage}%`) + 
      this.colors.dim(` (${current}/${total})`);
    
    // Use carriage return to overwrite previous line
    process.stdout.write('\r' + progressLine + ' '.repeat(10));
    
    // New line when complete
    if (current === total) {
      console.log('');
    }
  }
  
  /**
   * Display LCARS-style header
   * @private
   */
  _displayHeader() {
    console.log(this.colors.frame('\n╔══════════════════════════════════════════════════════════╗'));
    console.log('║ ' + this.colors.orange('█████') + ' ' + 
               this.colors.text('DATABASE COVERAGE ANALYSIS') + ' ' +
               this.colors.orange('█████') + '      ║');
    console.log(this.colors.frame('╠══════════════════════════════════════════════════════════╣'));
  }
  
  /**
   * Display overall coverage status with progress bar
   * @private
   */
  _displayOverallStatus(coverage) {
    const percentage = Math.round(coverage.percentage);
    const barWidth = 40;
    const filledWidth = Math.round((percentage / 100) * barWidth);
    
    // Color based on coverage level
    let statusColor = this.colors.covered;
    let statusText = 'OPTIMAL';
    
    if (percentage < 50) {
      statusColor = this.colors.red;
      statusText = 'CRITICAL';
    } else if (percentage < 75) {
      statusColor = this.colors.warning;
      statusText = 'WARNING';
    } else if (percentage < 90) {
      statusColor = this.colors.blue;
      statusText = 'ACCEPTABLE';
    }
    
    // Create visual progress bar
    const filled = this.chars.filled.repeat(filledWidth);
    const empty = this.chars.empty.repeat(barWidth - filledWidth);
    const bar = statusColor(filled) + this.colors.dim(empty);
    
    console.log('║ Overall Coverage: [' + bar + '] ' + 
                statusColor(`${percentage}%`) + ' ' + statusColor(statusText) + '  ║');
    console.log('║ ' + this.colors.dim(`Items: ${coverage.covered}/${coverage.total} covered`) + 
                ' '.repeat(35) + ' ║');
  }
  
  /**
   * Display coverage breakdown by category
   * @private
   */
  _displayCategoryBreakdown(categories) {
    if (!categories || Object.keys(categories).length === 0) {
      return;
    }
    
    console.log(this.colors.frame('╠══════════════════════════════════════════════════════════╣'));
    console.log('║ ' + this.colors.blue('COVERAGE BY CATEGORY') + 
                ' '.repeat(37) + ' ║');
    console.log(this.colors.frame('╠══════════════════════════════════════════════════════════╣'));
    
    Object.entries(categories).forEach(([category, percentage]) => {
      const barWidth = 20;
      const filledWidth = Math.round((percentage / 100) * barWidth);
      
      // Color based on percentage
      const color = percentage >= 90 ? this.colors.covered : 
                   percentage >= 75 ? this.colors.warning : 
                   this.colors.uncovered;
      
      const filled = this.chars.filled.repeat(filledWidth);
      const empty = this.chars.empty.repeat(barWidth - filledWidth);
      const bar = color(filled) + this.colors.dim(empty);
      
      const categoryName = category.padEnd(12);
      const percentageText = `${Math.round(percentage)}%`.padStart(4);
      
      console.log('║ ' + this.colors.text(categoryName) + 
                  ' [' + bar + '] ' + 
                  color(percentageText) + ' '.repeat(19) + ' ║');
    });
  }
  
  /**
   * Display coverage gaps with highlighting
   * @private
   */
  _displayGaps(gaps) {
    console.log(this.colors.frame('╠══════════════════════════════════════════════════════════╣'));
    console.log('║ ' + this.colors.red('COVERAGE GAPS DETECTED') + 
                ' '.repeat(35) + ' ║');
    console.log(this.colors.frame('╠══════════════════════════════════════════════════════════╣'));
    
    // Group gaps by category
    const groupedGaps = gaps.reduce((acc, gap) => {
      if (!acc[gap.category]) {
        acc[gap.category] = [];
      }
      acc[gap.category].push(gap);
      return acc;
    }, {});
    
    Object.entries(groupedGaps).forEach(([category, categoryGaps]) => {
      console.log('║ ' + this.colors.warning(`${category.toUpperCase()}:`) + 
                  ' '.repeat(55 - category.length) + ' ║');
      
      categoryGaps.slice(0, 5).forEach(gap => { // Limit to first 5 per category
        const indicator = this.colors.red('●');
        const name = gap.name.length > 40 ? gap.name.substring(0, 37) + '...' : gap.name;
        const reason = gap.reason ? ` (${gap.reason})` : '';
        const maxReasonLength = Math.max(0, 54 - name.length - reason.length);
        const truncatedReason = reason.length > maxReasonLength ? 
          reason.substring(0, maxReasonLength - 3) + '...' : reason;
        
        console.log('║   ' + indicator + ' ' + 
                    this.colors.text(name) + 
                    this.colors.dim(truncatedReason) + 
                    ' '.repeat(Math.max(0, 54 - name.length - truncatedReason.length)) + ' ║');
      });
      
      if (categoryGaps.length > 5) {
        console.log('║   ' + this.colors.dim(`... and ${categoryGaps.length - 5} more`) + 
                    ' '.repeat(45) + ' ║');
      }
    });
  }
  
  /**
   * Display summary and recommendations
   * @private
   */
  _displaySummary(coverage, gaps) {
    console.log(this.colors.frame('╠══════════════════════════════════════════════════════════╣'));
    console.log('║ ' + this.colors.blue('ANALYSIS SUMMARY') + 
                ' '.repeat(41) + ' ║');
    console.log(this.colors.frame('╠══════════════════════════════════════════════════════════╣'));
    
    // Status assessment
    const percentage = Math.round(coverage.percentage);
    let recommendation = '';
    let priorityColor = this.colors.text;
    
    if (percentage >= 90) {
      recommendation = 'Coverage is excellent. Maintain current test standards.';
      priorityColor = this.colors.covered;
    } else if (percentage >= 75) {
      recommendation = 'Good coverage. Consider adding tests for critical gaps.';
      priorityColor = this.colors.blue;
    } else if (percentage >= 50) {
      recommendation = 'Moderate coverage. Focus on high-priority areas first.';
      priorityColor = this.colors.warning;
    } else {
      recommendation = 'Low coverage detected. Immediate attention required.';
      priorityColor = this.colors.red;
    }
    
    // Split long recommendations into multiple lines
    const maxLineLength = 55;
    const words = recommendation.split(' ');
    const lines = [];
    let currentLine = '';
    
    words.forEach(word => {
      if ((currentLine + word).length <= maxLineLength) {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);
    
    lines.forEach(line => {
      console.log('║ ' + priorityColor(line) + 
                  ' '.repeat(Math.max(0, 57 - line.length)) + ' ║');
    });
    
    if (gaps && gaps.length > 0) {
      console.log('║ ' + this.colors.dim(`Priority: Address ${gaps.length} identified gaps`) + 
                  ' '.repeat(25) + ' ║');
    }
  }
  
  /**
   * Display LCARS-style footer
   * @private
   */
  _displayFooter() {
    console.log(this.colors.frame('╚══════════════════════════════════════════════════════════╝'));
    console.log('');
  }
}

module.exports = CoverageVisualizer;