# Example D.A.T.A. Project Structure

This directory demonstrates the required structure for a D.A.T.A.-managed database project.

## SQL Directory Structure

The `/sql/` directory follows Supa Fleet Directive 34.1 with numbered directories that control compilation order:

```
sql/
├── 001_extensions/   # PostgreSQL extensions (must come first)
├── 002_schemas/      # Schema definitions
├── 003_types/        # Custom types and enums
├── 004_tables/       # Table definitions
├── 005_functions/    # Stored procedures and functions
├── 006_views/        # Views and materialized views
├── 007_policies/     # Row Level Security policies
├── 008_triggers/     # Database triggers
├── 009_indexes/      # Index definitions
└── 010_data/         # Seed/initial data
```

## Example SQL Files

Place your SQL files in the appropriate directories:

### 001_extensions/uuid.sql
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 004_tables/users.sql
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 007_policies/users_rls.sql
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own record" 
  ON users FOR SELECT 
  USING (auth.uid() = id);
```

## Usage

1. Initialize D.A.T.A. in your project:
   ```bash
   data init
   ```

2. Compile your SQL into a migration:
   ```bash
   data db compile
   ```

3. Test the migration:
   ```bash
   data test
   ```

4. Deploy to production:
   ```bash
   data align production
   ```

## Important Notes

- The numerical prefix (001, 002, etc.) is **REQUIRED** and controls order
- Each directory should contain related SQL files
- Files within a directory are processed alphabetically
- Dependencies must be resolved by the directory ordering