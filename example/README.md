# Example D.A.T.A. Project Structure

This directory demonstrates the required structure for a D.A.T.A.-managed database project.

## SQL Directory Structure

The `/sql/` directory uses standard directory names that D.A.T.A. processes in the correct order:

```
sql/
├── extensions/   # PostgreSQL extensions
├── schemas/      # Schema definitions
├── types/        # Custom types and enums
├── tables/       # Table definitions
├── functions/    # Stored procedures and functions
├── views/        # Views and materialized views
├── policies/     # Row Level Security policies
├── triggers/     # Database triggers
├── indexes/      # Index definitions
└── data/         # Seed/initial data
```

## Example SQL Files

Place your SQL files in the appropriate directories:

### extensions/uuid.sql
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### tables/users.sql
```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### policies/users_rls.sql
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

## Demo Scripts

### functions-demo.sh
A demonstration script showing Edge Functions integration with D.A.T.A.:
```bash
./functions-demo.sh
```

This script demonstrates:
- Validating Edge Functions
- Deploying functions alongside migrations
- Checking deployment status
- Production deployment with safety gates

## Important Notes

- Directory names should match the standard names (extensions, tables, etc.)
- D.A.T.A. automatically handles the compilation order
- Each directory should contain related SQL files
- Files within a directory are processed alphabetically