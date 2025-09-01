const {
  TestCoverageError,
  ValidationError,
  CoverageEnforcementError,
  ParsingError,
} = require("./errors");

function handleTestingError(err, logger = console) {
  if (err instanceof ValidationError) {
    logger.warn(err.toJSON());
    process.exitCode = 2;
    return;
  }
  if (err instanceof CoverageEnforcementError) {
    logger.error(err.toJSON());
    process.exitCode = 3;
    return;
  }
  if (err instanceof ParsingError) {
    logger.error(err.toJSON());
    process.exitCode = 4;
    return;
  }
  if (err instanceof TestCoverageError) {
    logger.error(err.toJSON());
    process.exitCode = 1;
    return;
  }
  logger.error({ name: err?.name, message: err?.message, err });
  process.exitCode = 1;
}
module.exports = { handleTestingError };
