# DATA — Database Automation, Testing, and Alignment 🖖

> [!warning]- **Work in Progress**  
> This project is actively in pre-release, ***use at your own risk!***  
> **See** [/issues/README.md](the issues README) to get a sense of current progress.  
> **Recommended:** Await a public release before using.

**Golden SQL in git → deterministic migrations → tested → safe to deploy. Zero drift.**

```bash
npm i -g @starfleet/data
data status
data automate && data test && data promote
data align production
```

> "I am detecting zero anomalies in your database schema, Captain." — Lt. Commander Data

## TL;DR

- **Declarative, Git-first:** Maintain one **golden set of SQL** in your repo. No hand-written migrations.
- **Automated diffs:** DATA **compiles** your SQL, **diffs** against the last tag, and **emits migrations** deterministically (no DB introspection).
- **Hard safety gates:** Refuses prod if **dirty**, **behind**, **wrong branch**, or **tests failing**.
- **Rollbackable by design:** Every deploy is tagged; rollbacks are exact and boring.

## The DATA Pipeline

```
Compile → Diff → Test → Promote → Align

GOLDEN SQL (repo) ---compile--> Canonical SQL
                      |
                      +---diff (vs last tag)--> Migration Plan
                                       |
                           test (must pass 100%)
                                       |
                       promote (git tag + metadata)
                                       |
                         align <env> (apply plan safely)
```

## 1. Golden SQL (The Prime Directive)

You maintain **golden SQL modules** in git. You never write migrations by hand.

```text
/supabase/sql/
  001_extensions/
    uuid.sql
    pgcrypto.sql
  002_schemas/
    public.sql
    auth.sql
  003_tables/
    users.sql
    posts.sql
  010_policies/
    users_rls.sql
    posts_rls.sql
```

DATA compiles your SQL, diffs against the last **environment tag**, and generates migrations deterministically. Same repo state → same migration plan. No database introspection. No drift. No surprises.

## 2. Quick Start

```bash
# Install
npm i -g @starfleet/data

# Generate migrations from golden SQL
data automate

# Run tests (pgTAP or your runner)
data test

# Promote (tag) the release
data promote

# Align an environment to the promoted tag
data align production
```

## 3. Safety Gates (Non-Negotiable)

| Gate | What DATA Checks | Prod Behavior |
|------|------------------|---------------|
| **Clean repo** | No uncommitted/untracked files | 🔴 **BLOCK** |
| **Up-to-date** | Not behind origin/main | 🔴 **BLOCK** |
| **Allowed branch** | main (configurable) | 🔴 **BLOCK** |
| **Tests passing** | 100% required (configurable) | 🔴 **BLOCK** |
| **Big change confirm** | >N DDL operations | 🟡 **TYPE-TO-CONFIRM** |

*"Proceeding without corrections would be... illogical."*

## 4. Core Commands

| Command | Purpose | Safety Level |
|---------|---------|--------------|
| `data status` | Show current state vs environments | Safe |
| `data automate` | Compile SQL & generate migration plan | Safe |
| `data test` | Run test suite (required for prod) | Safe |
| `data promote` | Tag the tested plan | Safe |
| `data align <env>` | Apply promoted plan to environment | **Gated** |
| `data rollback --to-tag <tag>` | Revert to specific tag | **Gated** |
| `data analyze` | Report drift and differences | Safe |

## 5. Git-First Deployments

Every deployment creates an immutable tag:

```bash
# Tag format (configurable)
data/prod/2025.241.1430
data/staging/2025.241.1200

# Rollback to any previous state
data rollback --to-tag data/prod/2025.241.0900

# See deployment history
data history production
```

## 6. Configuration

```json
{
  "deployment": {
    "allowedBranches": { 
      "production": ["main"],
      "staging": ["main", "staging"]
    },
    "requireCleanWorkingDirectory": true,
    "requireUpToDateWithRemote": true,
    "autoTag": true,
    "tagPrefix": "data"
  },
  "test": {
    "runner": "pgtap",
    "minimum_coverage": 95,
    "enforce": true
  },
  "personality": "android"  // android | quiet | tng
}
```

## 7. Real Example: The Riker Incident

```bash
# Commander Riker tries to YOLO deploy
$ data align production

🔴 RED ALERT: Working directory not clean
   Modified: sql/tables/users.sql
   
   Commander, your working directory contains uncommitted changes.
   Probability of catastrophic failure: 87.3%
   
   Recommended action: git commit or git stash
   
# After cleanup
$ data align production

✅ All safety checks passed
   - Repository: clean
   - Branch: main (approved)
   - Tests: 147/147 passing (100%)
   - Coverage: 97.3%
   
   Migration summary:
   + CREATE TABLE crew_evaluations
   + ALTER TABLE users ADD COLUMN shore_leave_balance
   
   Type 'ENGAGE' to proceed: ENGAGE
   
   Deployment successful. "Make it so" achieved.
```

## 8. Why DATA vs Others?

| Feature | DATA | Flyway | Liquibase | Supabase Migrations |
|---------|------|--------|-----------|-------------------|
| **Golden SQL** | ✅ Git-native | ❌ Migrations | ❌ Changelog | ❌ Migrations |
| **Deterministic** | ✅ Pure git diff | ⚠️ DB introspection | ⚠️ DB introspection | ❌ Manual |
| **Hard gates** | ✅ Non-negotiable | ⚠️ Optional | ⚠️ Optional | ❌ None |
| **Rollback story** | ✅ Tag-based | ⚠️ Down scripts | ⚠️ Rollback tags | ❌ Manual |
| **TUI preview** | ✅ LCARS mode | ❌ | ❌ | ❌ |

## 9. Project Structure

### SQL Directory Organization (Required)

Your `/sql/` directory MUST follow this numbered structure per Supa Fleet Directive 34.1:

```
/sql/
  001_extensions/   -- PostgreSQL extensions (uuid-ossp, pgcrypto, etc.)
  002_schemas/      -- Schema definitions  
  003_types/        -- Custom types and enums
  004_tables/       -- Table definitions
  005_functions/    -- Stored procedures and functions
  006_views/        -- Views and materialized views
  007_policies/     -- RLS (Row Level Security) policies
  008_triggers/     -- Database triggers
  009_indexes/      -- Index definitions
  010_data/         -- Seed/initial data
```

**The numerical prefix is CRITICAL** - it controls compilation order:
- Extensions must exist before tables use them
- Schemas before tables are placed in them
- Tables before foreign keys reference them
- Functions before triggers call them

### Operational Directory

D.A.T.A. creates a `.data/` directory for operational files:

```
.data/
  cache/    -- Cached data for performance
  temp/     -- Temporary files during operations
  build/    -- Build artifacts
  *.log     -- Operation logs
```

This directory is automatically created and should be gitignored (already configured).

## 10. CI/CD Integration

```yaml
# .github/workflows/database.yml
- name: Database Pipeline
  run: |
    data automate
    data test
    data promote
    
- name: Deploy to Production
  if: github.ref == 'refs/heads/main'
  run: |
    data align production --yes
```

## 10. Personality Modes

DATA adapts to your environment:

```bash
# Android mode (default) - Lt. Commander Data's precision
DATA_PERSONALITY=android data status
> "Database synchronization at 99.97% efficiency."

# Quiet mode - Just the facts for CI/logs
DATA_PERSONALITY=quiet data status
> production: aligned (v2.3.45)

# TNG mode - Full bridge crew experience
DATA_PERSONALITY=tng data status
> "Captain on the bridge! All stations report ready."
> Geordi: "Warp core... I mean, database is running smooth as silk!"

# Override for demos
data status --personality tng
```

## Advanced Features

### Drift Detection

```bash
data analyze production
# Shows exact differences between repo and production
# No more "what's actually deployed?"
```

### Migration Preview

```bash
data automate --dry-run
# See exactly what SQL will be generated
# Review before committing
```

### Custom Test Runners

```json
{
  "test": {
    "runner": "custom",
    "command": "npm run test:database",
    "successExitCode": 0
  }
}
```

### Environment-Specific Configuration

```json
{
  "environments": {
    "production": {
      "requireApproval": true,
      "minimumReviewers": 2,
      "slackWebhook": "https://..."
    }
  }
}
```

## Installation

### From NPM

```bash
npm install -g @starfleet/data
```

### From Source

```bash
git clone https://github.com/starfleet/supa-data.git
cd supa-data
npm install
npm link
```

### Requirements

- Node.js >= 18.0.0
- Git
- PostgreSQL or Supabase project
- Coffee (optional but recommended)

## Troubleshooting

### "Working directory not clean"

```bash
git status  # Check what's modified
git add . && git commit -m "Save work"
# OR
git stash
```

### "Behind origin/main"

```bash
git pull origin main
```

### "Tests failing"

```bash
data test --verbose
# Fix the failing tests
# DATA won't let you break production
```

## The Philosophy

**Golden SQL is truth. Git is memory. Tests are trust.**

DATA enforces this philosophy through non-negotiable gates. You cannot deploy untested code. You cannot deploy from a dirty repository. You cannot accidentally destroy production.

This isn't about restricting developers—it's about giving them confidence. When DATA says your deployment is safe, it's safe. When it says stop, something is genuinely wrong.

*"In my observations of human behavior, I have noticed that engineers sleep better when their deployments cannot accidentally destroy everything."* — Lt. Commander Data

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

For the full Star Trek experience and extended universe, visit [docs/fun/](docs/fun/).

## License

MIT

---

**Live long and prosper.** 🖖

*P.S. - Spot has been fed. Database operations may proceed.*
