/**
 * Thin command wrapper for migrate apply
 * All business logic is in the use-case
 */

export async function run({ services }, flags) {
  // Parse command-line flags
  const sqlRoot = flags.sqlRoot || flags['sql-dir'] || 'sql';
  const dryRun = flags['dry-run'] || flags.dryRun || false;
  const skipSafety = flags['skip-safety'] || false;

  // Run safety checks unless skipped
  if (!skipSafety && !dryRun) {
    const policy = {
      requireClean: true,
      allowedBranches: ['main', 'master', 'develop'],
      requireTests: false, // Can be enabled via flag
      requireUpToDate: false
    };

    const safetyResult = await services.useCases.verifySafetyGates.execute(policy);

    if (!safetyResult.passed) {
      services.ports.logger.error(
        { failures: safetyResult.failures },
        'Safety checks failed. Use --skip-safety to override (dangerous!)'
      );
      services.ports.proc.exit(1);
    }
  }

  // Generate the migration plan
  const plan = await services.useCases.generateMigrationPlan.execute({
    sqlRoot
  });

  // Apply the migration
  const result = await services.useCases.applyMigrationPlan.execute({
    plan,
    dryRun
  });

  // Handle result
  if (!result.success && !dryRun) {
    services.ports.logger.error(
      { errors: result.errors },
      'Migration failed'
    );
    services.ports.proc.exit(1);
  }

  return result;
}
