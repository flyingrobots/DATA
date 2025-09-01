/**
 * ClockAdapter - Node.js implementation of ClockPort
 */
export const ClockAdapter = {
  now: () => new Date(),
  nowMs: () => Date.now()
};
