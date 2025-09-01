/**
 * Edge Functions Status Command
 *
 * Shows deployment status, health, and metrics for Edge Functions
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Command from '../../lib/Command.js';

class StatusCommand extends Command {
  constructor(config, logger = null, isProd = false) {
    super(config, logger, isProd);
    this.requiresProductionConfirmation = false; // Status checks are safe
  }

  /**
   * Execute functions status check
   * @param {string[]|null} functionNames - Specific functions to check, or null for all
   */
  async performExecute(functionNames = null) {
    this.progress('📊 Checking Edge Functions status');

    try {
      // Check if supabase CLI is available
      try {
        execSync('supabase --version', { stdio: 'pipe' });
      } catch (error) {
        throw new Error('Supabase CLI not found. Please install: npm install -g supabase');
      }

      // Get local functions
      const localFunctions = await this.getLocalFunctions(functionNames);

      // Get deployed functions
      const deployedFunctions = await this.getDeployedFunctions();

      // Combine status information
      const statusMap = this.combineStatus(localFunctions, deployedFunctions);

      this.emit('status-retrieved', {
        local: localFunctions.length,
        deployed: deployedFunctions.length,
        functions: statusMap
      });

      // Display status summary
      this.displayStatusSummary(statusMap);

      return statusMap;

    } catch (error) {
      this.error('Failed to retrieve functions status', error);
      throw error;
    }
  }

  /**
   * Get local functions from filesystem
   */
  async getLocalFunctions(functionNames = null) {
    const functionsPath = this.outputConfig.functionsDir;

    if (!fs.existsSync(functionsPath)) {
      return [];
    }

    const entries = fs.readdirSync(functionsPath, { withFileTypes: true });
    let functions = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => !name.startsWith('.'));

    // Filter by specified function names if provided
    if (functionNames && functionNames.length > 0) {
      functions = functions.filter(name => functionNames.includes(name));
    }

    const localFunctions = [];

    for (const functionName of functions) {
      const functionPath = path.join(functionsPath, functionName);
      const indexPath = path.join(functionPath, 'index.ts');

      let size = 0;
      let lastModified = null;
      let hasConfig = false;

      try {
        if (fs.existsSync(indexPath)) {
          const stats = fs.statSync(indexPath);
          size = stats.size;
          lastModified = stats.mtime;
        }

        const denoJsonPath = path.join(functionPath, 'deno.json');
        hasConfig = fs.existsSync(denoJsonPath);

      } catch (error) {
        this.warn(`Could not read stats for function: ${functionName}`);
      }

      localFunctions.push({
        name: functionName,
        path: functionPath,
        size,
        lastModified,
        hasConfig,
        hasIndex: fs.existsSync(indexPath)
      });
    }

    return localFunctions;
  }

  /**
   * Get deployed functions from Supabase
   */
  async getDeployedFunctions() {
    try {
      this.progress('🌐 Fetching deployed functions from Supabase');

      const result = execSync('supabase functions list --json', {
        stdio: 'pipe',
        encoding: 'utf8'
      });

      const deployedFunctions = JSON.parse(result);

      return deployedFunctions.map(func => ({
        name: func.name,
        id: func.id,
        status: func.status || 'unknown',
        createdAt: func.created_at,
        updatedAt: func.updated_at,
        version: func.version
      }));

    } catch (error) {
      this.warn('Could not retrieve deployed functions list', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Combine local and deployed status information
   */
  combineStatus(localFunctions, deployedFunctions) {
    const statusMap = new Map();

    // Add local functions
    for (const local of localFunctions) {
      statusMap.set(local.name, {
        name: local.name,
        local,
        deployed: null,
        status: 'local-only'
      });
    }

    // Add deployed functions
    for (const deployed of deployedFunctions) {
      const existing = statusMap.get(deployed.name);

      if (existing) {
        existing.deployed = deployed;
        existing.status = 'deployed';
      } else {
        statusMap.set(deployed.name, {
          name: deployed.name,
          local: null,
          deployed,
          status: 'deployed-only'
        });
      }
    }

    return Array.from(statusMap.values());
  }

  /**
   * Display status summary
   */
  displayStatusSummary(statusMap) {
    const localOnly = statusMap.filter(f => f.status === 'local-only');
    const deployed = statusMap.filter(f => f.status === 'deployed');
    const deployedOnly = statusMap.filter(f => f.status === 'deployed-only');

    this.success('📈 Functions Status Summary', {
      total: statusMap.length,
      localOnly: localOnly.length,
      deployed: deployed.length,
      deployedOnly: deployedOnly.length
    });

    // Emit detailed status for each function
    for (const func of statusMap) {
      const statusData = {
        name: func.name,
        status: func.status
      };

      if (func.local) {
        statusData.local = {
          hasIndex: func.local.hasIndex,
          hasConfig: func.local.hasConfig,
          size: func.local.size,
          lastModified: func.local.lastModified?.toISOString()
        };
      }

      if (func.deployed) {
        statusData.deployed = {
          id: func.deployed.id,
          version: func.deployed.version,
          createdAt: func.deployed.createdAt,
          updatedAt: func.deployed.updatedAt
        };
      }

      this.emit('function-status', statusData);
    }

    // Warn about potential issues
    if (localOnly.length > 0) {
      this.warn(`${localOnly.length} function(s) exist locally but are not deployed`, {
        functions: localOnly.map(f => f.name)
      });
    }

    if (deployedOnly.length > 0) {
      this.warn(`${deployedOnly.length} function(s) are deployed but not found locally`, {
        functions: deployedOnly.map(f => f.name)
      });
    }
  }
}

export default StatusCommand;
