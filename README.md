# DATA — Database Automation, Testing, and Alignment 🖖

> [!info] **Work In Progress**
> 🚧 This project is heavily under construction! Use at your own risk until the first release drops.
> It ain't ready yet, folks!

**Stop writing migrations by hand. Maintain golden SQL in git → get bulletproof database deployments.**

<p align="center">
<img src="https://repository-images.githubusercontent.com/1047551118/e88e7fab-040e-4684-80e2-98aa580d71fa" width="500" />
</p>

DATA generates deterministic migrations from your SQL source files and blocks unsafe deployments with non-negotiable safety gates. Zero drift, zero surprises, zero 3 AM outages.

```bash
# TODO add demo instructions for installing and using once it's been released
```

> [!warning]- **Work in Progress**  
> This project is actively in pre-release, ***use at your own risk!***  
> **See** [/issues/README.md](the issues README) to get a sense of current progress.

## How It Works

**Golden SQL → Deterministic Migrations → Safety Gates → Deploy**

1. **Write SQL** in organized `/sql/` modules (tables, functions, policies)
2. **Generate migrations** with `data automate` (pure git diff, no DB introspection)
3. **Test everything** with `data test` (pgTAP or custom runners)
4. **Tag and deploy** with `data promote && data align <env>`

Same repo state = identical migration plan. Every time.

## Quick Example

```bash
# Your SQL modules (the golden source)
/sql/
  extensions/uuid.sql
  tables/users.sql
  policies/users_rls.sql

# DATA generates this automatically
$ data automate
✅ Generated migration: ADD COLUMN users.metadata jsonb
✅ Generated migration: CREATE POLICY user_read_own_data

$ data test
✅ All 47 database tests passing (100% coverage)

$ data align production
🔴 BLOCKED: Working directory not clean
   Modified: sql/tables/users.sql
   "Commander, your working directory contains uncommitted changes."
```

## Getting Started

```bash
# 1. Install
# TODO add instructions when it's published

# 2. Organize your SQL in named directories
/sql/
  extensions/    # PostgreSQL extensions
  tables/        # Table definitions  
  policies/      # RLS policies
  # etc.
  
# 3. The DATA workflow
data automate      # Generate migration plan
data test          # Run your test suite
data promote       # Tag the tested release
data align staging # Deploy to staging
data align production --confirm  # Deploy to prod (with confirmation)
```

## Safety Gates (Non-Negotiable)

DATA **blocks production deployments** unless:

- ✅ **Clean repo** (no uncommitted/untracked files)
- ✅ **Up-to-date** (not behind origin/main) 
- ✅ **Correct branch** (main, configurable)
- ✅ **Tests passing** (100% required, configurable)

Large changes require typing confirmation. *"Proceeding without corrections would be... illogical."*

## Core Commands

| Command | Purpose |
|---------|---------|
| `data status` | Show current state vs environments |
| `data automate` | Generate migration plan from SQL |
| `data test` | Run test suite (required for prod) |
| `data promote` | Tag the tested release |
| `data align <env>` | Deploy to environment (🔐 **gated**) |
| `data rollback --to-tag <tag>` | Revert to any previous tag |
| `data analyze` | Detect drift between repo and DB |

## Git-First Deployments

Every deployment creates an immutable git tag. Rollbacks are exact and boring:

```bash
# Deploy creates tags automatically  
data align production
# → Creates: data/prod/2025.241.1430

# Rollback to any point in history
data rollback --to-tag data/prod/2025.241.0900

# See what's deployed where
data status
# production: aligned @ data/prod/2025.241.1430
# staging:    ahead by 3 commits
```

## Why DATA vs Others?

| Feature | DATA | Flyway | Liquibase | Supabase CLI |
|---------|------|--------|-----------|--------------|
| **Golden SQL** | ✅ Git-native | ❌ Hand-written migrations | ❌ Changelog format | ❌ Hand-written |
| **Deterministic** | ✅ Pure git diff | ⚠️ DB introspection | ⚠️ DB introspection | ❌ Manual |
| **Production gates** | ✅ Non-negotiable | ⚠️ Optional | ⚠️ Optional | ❌ None |
| **Rollback** | ✅ Tag-based | ⚠️ Down scripts | ⚠️ Manual tags | ❌ Manual |
| **Personality** | 🖖 Lt. Commander Data | 😐 | 😐 | 😐 |

## Example: Safety Gates in Action

```bash
# Trying to deploy dirty code? Not on DATA's watch
$ data align production

🔴 RED ALERT: Working directory not clean
   Modified: sql/tables/users.sql
   
   Commander, your working directory contains uncommitted changes.
   Probability of catastrophic failure: 87.3%
   
   Recommended action: git commit or git stash

# After fixing
$ data align production

✅ All safety checks passed
   - Repository: clean ✅
   - Branch: main (approved) ✅  
   - Tests: 147/147 passing (100%) ✅
   
   Migration preview:
   + CREATE TABLE crew_evaluations
   + ALTER TABLE users ADD COLUMN shore_leave_balance
   
   Type 'ENGAGE' to proceed: ENGAGE
   
   Deployment successful. "Make it so" achieved.
```

## Recommended Directory Structure

Your repository should organize supabase-related files in the following prescribed way (although you can override and configure however you'd like via `datarc.json`)

### `/sql/` Directory

The `/sql/` directory is where your "golden sql" files should live. You must sort your source sql files into the following directory structure. You may nest directories within each of these however you'd like. The reason this is required is because sql statements must be arranged in the proper order, and, really, this is just to help the sql compiler do less work. When the compiler handles each of these directories, it'll find all sql files within each one, recursively, then sort all the paths lexicographically. Then it appends the files in the order specified to the compiled sql file.

```
/sql/
  extensions/   # PostgreSQL extensions
  tables/       # Tables and relationships  
  functions/    # Stored procedures
  policies/     # RLS policies
  indexes/      # Performance indexes
  data/         # Seed data
```

**D.A.T.A. handles the order:** Extensions → schemas → tables → functions → triggers. Dependencies are automatically resolved.

## Configuration

```json
{
  "deployment": {
    "allowedBranches": { "production": ["main"] },
    "requireCleanWorkingDirectory": true,
    "autoTag": true
  },
  "test": {
    "runner": "pgtap",
    "minimum_coverage": 95,
    "enforce": true
  },
  "personality": "android"  // android | quiet | tng
}
```

## CI/CD Integration

```yaml
# .github/workflows/database.yml
- name: Database Pipeline
  run: |
    data automate
    data test
    data promote
    
- name: Deploy to Production  
  if: github.ref == 'refs/heads/main'
  run: data align production --confirm
```

## Advanced Features

**Drift Detection:** `data analyze production` shows exact differences between repo and deployed state

**Migration Preview:** `data automate --dry-run` lets you review SQL before committing

**Personality Modes:** Choose from `android` (default), `quiet` (CI-friendly), or `tng` (full bridge crew)

**Custom Test Runners:** Integrate with any test framework via configuration

## Installation & Requirements

```bash
npm install -g @starfleet/data
```

**Requirements:** Node.js 18+, Git, PostgreSQL/Supabase

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Working directory not clean" | `git commit` or `git stash` |
| "Behind origin/main" | `git pull origin main` |  
| "Tests failing" | Fix tests, DATA won't deploy broken code |

## The Philosophy

**Golden SQL is truth. Git is memory. Tests are trust.**

DATA enforces bulletproof deployments through non-negotiable safety gates. This isn't about restricting developers—it's about giving them confidence. When DATA approves your deployment, you can sleep soundly.

*"In my observations of human behavior, I have noticed that engineers sleep better when their deployments cannot accidentally destroy everything."* — Lt. Commander Data

---

**Live long and prosper.** 🖖

*"Spot has been fed. Database operations may proceed."*

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) • [Star Trek Extended Universe](docs/fun/) • [MIT License](LICENSE)
