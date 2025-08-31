/**
 * EnvironmentAdapter - Node.js implementation of EnvironmentPort
 */
export const EnvironmentAdapter = {
  get: (key) => process.env[key],
  has: (key) => key in process.env
};