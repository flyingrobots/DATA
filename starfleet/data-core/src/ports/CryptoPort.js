/**
 * CryptoPort - Interface for cryptographic operations
 * Pure interface definition - no implementation
 *
 * @typedef {Object} CryptoPort
 * @property {(data: string, algorithm?: string) => string} hash - Generate hash of data
 * @property {() => string} randomUUID - Generate random UUID
 * @property {(length: number) => string} randomBytes - Generate random bytes as hex string
 * @property {(a: string, b: string) => boolean} timingSafeEqual - Timing-safe string comparison
 */

export {};
