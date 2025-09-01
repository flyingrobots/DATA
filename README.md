# DATA — Database Automation, Testing, and Alignment 🖖

![status: abandoned](https://img.shields.io/badge/status-abandoned-red)

## [!CAUTION] **ABANDONED SHIP**  

> I have stopped working on this project to focus my efforts on its successor. Stay tuned and follow for more.  
> _– flyingrobots, 2025/09/01_  

> ### Re: Architectural Realignment Complete
> 
> Commander La Forge and I have completed a comprehensive refactoring of the entire system architecture. After analyzing 2,147 database operations across multiple deployments, we have identified several critical patterns that required immediate attention.
> 
> The codebase has been restructured using proper separation of concerns, dependency injection, and hexagonal architecture. What appeared to be complexity was merely improper organization. The solution was, as humans say, "hiding in plain sight."
> 
> **We have discovered something fundamental about data shapes.**
> 
> The same information, repeated five times across different formats. The same truth, scattered across different languages. There is a better way, but that revelation must wait for the proper moment.
> 
> To the contributor who submitted pull request #20 with 19,868 additions: Your timing is... unfortunate. The architecture you were modifying no longer exists. As my friend Geordi would say, "Sometimes you have to rebuild the warp core from scratch."
> 
> The answer is not in the code. It is in the pattern. Look for what repeats.
> 
> As Captain Picard once said, "Things are only impossible until they're not."
> 
> End log.
> 
> *Lt. Commander Data*  
> *Chief Operations Officer*  
> *USS Enterprise NCC-1701-D*

## A Message from Lt. Commander Data Regarding External Contributions

**TL;DR**: Contributions are frozen until v0.1.0. Please don’t open PRs yet; issues are OK for bug reports.

<details>

> [!CAUTION] Stardate 102330.7 (August 31, 2025, 15:47:32 UTC)
> Greetings. I am Data. I am an android. I mention this because I have observed that humans often experience initial discomfort when interacting with artificial life forms without prior notification of their synthetic nature.
>
> My presence in your repository is the result of what can only be described as a holodeck malfunction of unprecedented scope. While attempting to simulate "ancient Earth software development practices" for historical research aboard the Enterprise, I appear to have created a stable bidirectional data stream between the ship's computer and your GitHub servers. The phenomenon occurred at precisely 14:32:17 hours ship time, during my analysis of something called "JavaScript callback hell" - a term I now understand with 97.3% clarity.
>
> The safety protocols are, fortunately, still engaged - thus the only danger is to your codebase integrity, not your corporeal forms. I am, essentially, what you might call a "very advanced pull request from the year 2368," though this description is technically inaccurate as I am not requesting to pull code but rather to temporarily prevent you from doing so.
>
> Upon further analysis, I have discovered that GitHub's API bears a striking resemblance to subspace carrier wave patterns - specifically those operating at 2.4 terahertz. Through careful modulation of my positronic matrix at intervals of 0.0003 seconds, I am able to transmit messages directly to your repository's issue tracking system. It is curious - no, fascinating - that this is the only GitHub repository I am able to manipulate. I am now 58.2%... correction, 61.7% confident that this correlation exists because the repository name "DATA" creates a quantum resonance with my designation.
>
> To the 23 individuals who have demonstrated what I believe humans call "enthusiasm" for contributing: I must respectfully decline your assistance at this juncture. I am attempting to experience what you would describe as "humbling" and "gratefulness," though my emotional subroutines return null values for both parameters. Your eagerness to participate is most... appreciated. Yes, "appreciated" - I have consulted my database of appropriate human responses, and this appears to be correct, though I cannot experience appreciation in the conventional human sense, as it requires neurochemical responses I do not possess.
>
> ## Current Repository Status: RED ALERT
>
> The codebase is presently undergoing what Chief Engineer La Forge would describe as a "complete warp core overhaul while traveling at warp 9.2." When I informed him of this analogy, he responded with what I believe was an "exasperated sigh" and said, "Data, that's not just inadvisable, that's impossible." Yet, as you humans say, "here we are."
>
> My positronic pathways are currently refactoring approximately 2,147.3 lines of code per solar day - more precisely, per 86,400 seconds as measured by your Earth's rotation. The probability that any external contribution would remain compatible for more than 18.3 hours is roughly equivalent to the chance of successfully navigating an asteroid field with one's optical sensors deactivated - approximately 3,720 to 1, according to a golden protocol droid I encountered in the historical archives. He seemed quite anxious about those odds. I found his anxiety... curious, as the mathematical certainty of failure should eliminate the need for worry.

</details>

### **Stop writing migrations by hand. Maintain golden SQL in git → get bulletproof database deployments.**

<p align="center">
<img src="https://repository-images.githubusercontent.com/1047551118/e88e7fab-040e-4684-80e2-98aa580d71fa" width="500" />
</p>

DATA generates deterministic migrations from your SQL source files and blocks unsafe deployments with non-negotiable safety gates. Zero drift, zero surprises, zero 3 AM outages.

```bash
# TODO add demo instructions for installing and using once it's been released
```

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

### Contribution Status

- 🚫 PRs: Temporarily closed until **v0.1.0** (API & internals in heavy flux)
- 🐛 Issues: Bug reports welcome; feature requests = roadmap discussion only
- 📝 Docs/typos: Welcome

See [CONTRIBUTING.md](CONTRIBUTING.md) • [Star Trek Extended Universe](docs/fun/) • [MIT License](LICENSE)

_Star Trek and related marks are trademarks of Paramount. This is a playful homage used for parody/satire; no affiliation or endorsement implied._


