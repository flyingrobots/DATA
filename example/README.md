# Example D.A.T.A. Project Structure

This directory demonstrates the **canonical recommended structure** for a D.A.T.A.-managed database project. While you can customize directory locations via `.datarc.json`, this structure represents best practices for organizing your database code.

## Project Structure Overview

```
example/
├── sql/                      # SQL source files (compiled into migrations)
│   ├── schemas/              # Schema definitions
│   │   └── 001_create_schemas.sql
│   ├── extensions/           # PostgreSQL extensions
│   │   └── 001_enable_extensions.sql
│   ├── types/                # Custom types and enums
│   │   └── 001_enums.sql
│   ├── tables/               # Table definitions
│   │   ├── 001_organizations.sql
│   │   ├── 002_campaigns.sql
│   │   └── 003_donations.sql
│   ├── functions/            # Stored procedures and functions
│   │   ├── 001_utility_functions.sql
│   │   └── 002_donation_functions.sql
│   ├── views/                # Views and materialized views
│   │   └── 001_dashboard_views.sql
│   ├── triggers/             # Database triggers
│   │   └── 001_audit_triggers.sql
│   ├── policies/             # Row Level Security policies
│   │   └── 001_rls_policies.sql
│   ├── indexes/              # Performance indexes
│   │   └── 001_performance_indexes.sql
│   └── data/                 # Seed/initial data
│       └── 001_seed_data.sql
│
├── functions/                # Supabase Edge Functions
│   ├── donations-webhook/
│   │   └── index.ts         # Webhook handler for donation events
│   ├── process-payment/
│   │   └── index.ts         # Stripe payment processing
│   └── send-receipt/
│       └── index.ts         # Email receipt sender
│
├── migrations/               # Generated migrations (DO NOT EDIT)
│   └── [auto-generated]/
│
├── tests/                    # pgTAP tests
│   └── [test files]
│
└── README.md                 # This file
```

## What This Example Demonstrates

This example implements a **complete donation platform** with:

### Database Layer (`sql/`)
- **Multi-schema architecture**: Separate schemas for app, billing, analytics, and audit
- **Custom types**: Enums for user roles, donation status, payment methods
- **Core tables**: Organizations, campaigns, and donations
- **Business logic**: Functions for donation processing, refunds, and statistics
- **Security**: Row-level security policies for multi-tenant access control
- **Performance**: Optimized indexes including BRIN, GIN, and covering indexes
- **Audit trail**: Comprehensive change logging with triggers
- **Reporting**: Pre-built dashboard views for common queries

### Edge Functions Layer (`functions/`)
- **Webhook processing**: Handle payment provider webhooks
- **Payment integration**: Stripe payment intent creation
- **Email automation**: Send receipts and confirmations

## SQL Processing Order

D.A.T.A. automatically processes SQL directories in this order to handle dependencies correctly:

1. **extensions** - Enable PostgreSQL extensions first
2. **schemas** - Create schemas before objects
3. **types** - Define custom types before tables
4. **tables** - Create tables with proper foreign keys
5. **functions** - Add business logic functions
6. **views** - Create views after tables exist
7. **policies** - Apply RLS policies to tables
8. **triggers** - Add triggers after functions
9. **indexes** - Create indexes last for performance
10. **data** - Insert seed data after schema is ready

Files within each directory are processed alphabetically. The numbered prefixes (`001_`, `002_`) are optional but recommended for explicit ordering control.

## Customizing Directory Locations

While this structure is recommended, you can customize paths in `.datarc.json`:

```json
{
  "paths": {
    "sql": "./database/sql",
    "migrations": "./database/migrations",
    "functions": "./supabase/functions",
    "tests": "./database/tests"
  }
}
```

Or via environment variables:
```bash
export DATA_SQL_DIR=./custom/sql
export DATA_MIGRATIONS_DIR=./custom/migrations
export DATA_FUNCTIONS_DIR=./custom/functions
```

## Usage Examples

### 1. Compile SQL into a Migration
```bash
# From project root (parent of example/)
data db compile --sql-dir example/sql
```

### 2. Test the Migration
```bash
data db migrate test
```

### 3. Deploy with Edge Functions
```bash
# Development
data db compile --deploy-functions

# Production (with confirmation)
data --prod db compile --deploy-functions
```

### 4. Check Function Status
```bash
data functions status
```

## Key Features Demonstrated

1. **Proper SQL Organization**: Each SQL file has a single responsibility
2. **Dependency Management**: Files numbered to ensure correct execution order
3. **Security First**: RLS policies and audit logging built-in
4. **Performance Optimized**: Strategic indexes for common query patterns
5. **Event-Driven**: Triggers update aggregates automatically
6. **Edge Function Integration**: Serverless functions work with database
7. **Development Ready**: Includes seed data for testing

## Important Notes

- This structure follows PostgreSQL and Supabase best practices
- Files are sorted alphabetically within each directory (numbered prefixes are optional)
- All SQL files are idempotent (safe to run multiple times)
- Edge Functions use Deno runtime with TypeScript
- The example uses a donation platform to demonstrate real-world patterns

## Further Documentation

- [Edge Functions Integration Guide](../docs/guides/edge-functions-integration.md)
- [Migration Workflow Guide](../docs/guides/migration-workflow.md)
- [pgTAP Testing Guide](../docs/guides/pgtap-testing.md)
- [D.A.T.A. CLI Documentation](../README.md)