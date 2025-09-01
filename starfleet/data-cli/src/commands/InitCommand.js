import fs from 'fs/promises';
import path from 'path';
import Command from '../lib/Command.js';

class InitCommand extends Command {
  constructor(options = {}) {
    super(null, null, false); // No config, no logger, not prod
    this.projectPath = options.path || process.cwd();
    this.requiresProductionConfirmation = false; // Init doesn't need prod confirmation
  }

  async performExecute() {
    this.emit('progress', {
      message: 'Initializing D.A.T.A. project structure. Resistance is futile.'
    });

    try {
      // Create directory structure
      const dirs = [
        'sql/001_extensions',
        'sql/002_schemas',
        'sql/003_tables',
        'sql/004_functions',
        'sql/005_policies',
        'sql/006_triggers',
        'sql/007_data',
        'migrations',
        'tests',
        'functions'
      ];

      for (const dir of dirs) {
        const dirPath = path.join(this.projectPath, dir);
        await fs.mkdir(dirPath, { recursive: true });
        this.emit('progress', {
          message: `Created directory: ${dir}`
        });
      }

      // Create .datarc.json config file
      const config = {
        '$schema': 'https://raw.githubusercontent.com/supabase/cli/main/schemas/config.json',
        'test': {
          'minimum_coverage': 80,
          'test_timeout': 300,
          'output_formats': ['console', 'json']
        },
        'environments': {
          'local': {
            'db': 'postgresql://postgres:postgres@localhost:54322/postgres'
          }
        }
      };

      await fs.writeFile(
        path.join(this.projectPath, '.datarc.json'),
        JSON.stringify(config, null, 2)
      );

      // Create example SQL files
      await this.createExampleFiles();

      this.emit('success', {
        message: 'Project initialization complete. Make it so!'
      });

      return {
        success: true,
        projectPath: this.projectPath
      };
    } catch (error) {
      this.emit('error', {
        message: `Initialization failed: ${error.message}`,
        error
      });
      throw error;
    }
  }

  async createExampleFiles() {
    // Create example extension file
    await fs.writeFile(
      path.join(this.projectPath, 'sql/001_extensions/uuid.sql'),
      `-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
`
    );

    // Create example schema file
    await fs.writeFile(
      path.join(this.projectPath, 'sql/002_schemas/public.sql'),
      `-- Public schema setup
GRANT USAGE ON SCHEMA public TO anon, authenticated;
`
    );

    // Create example table file
    await fs.writeFile(
      path.join(this.projectPath, 'sql/003_tables/maintenance.sql'),
      `-- Maintenance mode table
CREATE TABLE IF NOT EXISTS public.maintenance_mode (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  enabled boolean DEFAULT true,
  message text DEFAULT 'System maintenance in progress',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default maintenance mode
INSERT INTO public.maintenance_mode (enabled)
VALUES (true)
ON CONFLICT (id) DO NOTHING;
`
    );

    // Create example RLS policy
    await fs.writeFile(
      path.join(this.projectPath, 'sql/005_policies/maintenance_policies.sql'),
      `-- Enable RLS
ALTER TABLE public.maintenance_mode ENABLE ROW LEVEL SECURITY;

-- Allow read access to all
CREATE POLICY "Allow public read" ON public.maintenance_mode
  FOR SELECT
  TO public
  USING (true);
`
    );

    this.emit('progress', {
      message: 'Example SQL files created successfully'
    });
  }
}

export default InitCommand;
