/**
 * Thin command wrapper for migrate generate
 * All business logic is in the use-case
 */

export async function run({ services }, flags) {
  // Parse command-line flags
  const sqlRoot = flags.sqlRoot || flags['sql-dir'] || 'sql';
  const outputFile = flags.out || flags.output;
  const migrationName = flags.name;

  // Execute use-case
  const plan = await services.useCases.generateMigrationPlan.execute({
    sqlRoot,
    migrationName
  });

  // Write output if requested
  if (outputFile) {
    const outputPath = `${outputFile}`;
    await services.ports.fs.writeFile(outputPath, plan.preview);
    services.ports.logger.info({ file: outputPath }, `📝 Migration written to ${outputPath}`);
  } else {
    // Output to console if no file specified
    console.log('\n' + plan.preview);
  }

  return plan;
}
