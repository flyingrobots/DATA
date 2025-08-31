# D.A.T.A. Documentation Map

> _"An efficient filing system is essential to the proper functioning of any starship."_  
> — Lt. Commander Data

Welcome to the D.A.T.A. (Database Automation, Testing, and Alignment) documentation. This Map of Content (MoC) provides a structured overview of all available documentation.

## 📚 Documentation Structure

### 🚀 [Features](/docs/features/)

User-facing feature documentation and guides

- **[Edge Functions Integration](features/edge-functions.md)** - Deploy and manage Supabase Edge Functions alongside migrations
  - Deployment management, validation, and monitoring
  - Integration with migration workflow
  - Production safety features

### ⚙️ [Configuration](/docs/configuration/)

How to configure D.A.T.A. for your project

- **[Testing Configuration](configuration/testing.md)** - Configure test execution, coverage, and automation
  - Test timeout and coverage requirements
  - Output formats and parallel execution
  - Watch mode and auto-compilation settings

### 🔮 [Roadmap](/docs/roadmap/)

Future plans and vision for D.A.T.A.

- **[Ideas and Future Features](roadmap/ideas-and-future.md)** - The grand vision for D.A.T.A.'s evolution
  - Time-travel debugging and semantic migrations
  - Holodeck test environments and quantum rollback
  - AI-assisted migration intelligence

### 🔧 [Technical](/docs/technical/)

Implementation details and architecture documentation

- **[Memory Management](technical/memory-management.md)** - How D.A.T.A. handles large test suites
  - MemoryMonitor, StreamingCoverageDatabase, and BatchProcessor classes
  - Configuration options and performance characteristics
  - Troubleshooting memory issues

- **[Golden SQL Compilation Algorithm](technical/golden-sql-compilation-algorithm.md)** - The core compilation process
  - Module discovery and ordering
  - AST parsing and transformation
  - Migration generation

### 🎯 [Decisions](/docs/decisions/)

Architecture Decision Records (ADRs)

- **[CLI Framework](decisions/cli-framework.md)** - Why Commander.js was chosen
- **[Event Architecture](decisions/event-architecture.md)** - Event-driven command pattern
- **[Testing Strategy](decisions/testing-strategy.md)** - pgTAP and Vitest integration

### 📋 [Tasks](/docs/TASKS/)

Task management and project tracking

- **[System Tasks](TASKS/system.md)** - Core system improvements and features
- **[Test Tasks](TASKS/test.md)** - Testing infrastructure and coverage
- **[Migration Tasks](TASKS/migration.md)** - Migration system enhancements

### 🔍 [Audits](/docs/audits/)

Code quality and security audits

- Repository structure audits
- Security review documentation
- Performance analysis reports

### 👀 [Code Reviews](/docs/code-reviews/)

Code review templates and guidelines

- Review checklists
- Best practices documentation
- Common patterns and anti-patterns

### 🖖 [Fun](/docs/fun/)

Star Trek references and easter eggs

- **[Bridge Crew Personalities](fun/personalities.md)** - Different personality modes for D.A.T.A.
- **[Starfleet Regulations](fun/regulations.md)** - Database deployment protocols
- **[LCARS Interface](fun/lcars.md)** - The future of database UIs

## 🗺️ Quick Navigation Guide

### For New Users

1. Start with [Edge Functions Integration](features/edge-functions.md) to understand core features
2. Review [Testing Configuration](configuration/testing.md) to set up your project
3. Check the main [README](/README.md) for quick start instructions

### For Contributors

1. Read relevant [Architecture Decisions](decisions/) to understand design choices
2. Review [Technical Documentation](technical/) for implementation details
3. Check [Tasks](TASKS/) for current work items
4. Follow [Code Review Guidelines](code-reviews/) for contributions

### For System Architects

1. Study the [Golden SQL Compilation Algorithm](technical/golden-sql-compilation-algorithm.md)
2. Review [Memory Management](technical/memory-management.md) architecture
3. Explore [Ideas and Future Features](roadmap/ideas-and-future.md) for roadmap planning

## 📖 Documentation Standards

### File Naming

- Use kebab-case for all documentation files
- Be descriptive but concise (e.g., `memory-management.md` not `mm.md`)
- Group related docs in appropriate directories

### Content Structure

- Start with a clear title and overview
- Use hierarchical headings (H2 for main sections, H3 for subsections)
- Include code examples where relevant
- Add cross-references to related documentation

### Maintenance

- Keep documentation synchronized with code changes
- Archive outdated documentation rather than deleting
- Date significant updates in document headers
- Use relative links for internal references

## 🔄 Recent Updates

- **2024-08-30**: Reorganized documentation structure with clear categories
- **2024-08-30**: Merged memory management documentation
- **2024-08-30**: Created features, configuration, and roadmap directories

## 🤝 Contributing to Documentation

When adding new documentation:

1. **Choose the right location** based on the categories above
2. **Follow the naming conventions** (kebab-case, descriptive)
3. **Update this MoC** to include your new document
4. **Cross-reference** related documentation
5. **Include examples** where appropriate

## 🔗 External Resources

- [Main Repository](https://github.com/starfleet/supa-data)
- [Issue Tracker](https://github.com/starfleet/supa-data/issues)
- [Supabase Documentation](https://supabase.com/docs)
- [pgTAP Documentation](https://pgtap.org/)

---

_"The complexity of our documentation structure is directly proportional to the sophistication of our system. Both are... fascinating."_  
— Lt. Commander Data, Chief Documentation Officer
