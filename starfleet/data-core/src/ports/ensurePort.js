/**
 * Runtime port validation - catches missing method bugs instantly
 * Use in composition root to fail fast during container setup
 * 
 * @param {string} name - Port name for error messages
 * @param {any} obj - Object that should implement the port
 * @param {string[]} methods - Required method names
 * @returns {any} - The validated port object
 * @throws {Error} - If any required method is missing
 */
export function ensurePort(name, obj, methods) {
  for (const m of methods) {
    if (typeof obj?.[m] !== 'function') {
      throw new Error(`Port ${name} missing method: ${m}`);
    }
  }
  return obj;
}