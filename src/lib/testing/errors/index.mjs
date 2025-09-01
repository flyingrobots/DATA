// ESM wrapper that re-exports the SAME CJS instances
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const cjs = require("./index.js");
export const {
  TestCoverageError,
  ValidationError,
  CoverageEnforcementError,
  ParsingError,
} = cjs;
export default cjs;
