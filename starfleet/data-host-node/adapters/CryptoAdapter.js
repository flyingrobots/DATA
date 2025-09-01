import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { CryptoPort } from '../../data-core/ports/index.js';

/**
 * Node.js implementation of the Crypto port.
 * Wraps Node.js crypto APIs to provide standardized cryptographic operations.
 *
 * @class CryptoAdapter
 */
export class CryptoAdapter extends CryptoPort {
  /**
   * Create a new CryptoAdapter instance.
   *
   * @param {Object} options - Configuration options
   * @param {string} [options.defaultAlgorithm='sha256'] - Default hash algorithm
   * @param {string} [options.encoding='hex'] - Default output encoding
   */
  constructor(options = {}) {
    super();
    this.defaultAlgorithm = options.defaultAlgorithm || 'sha256';
    this.encoding = options.encoding || 'hex';
  }

  /**
   * Generate hash of data.
   *
   * @param {Buffer|Uint8Array|string} data - Data to hash
   * @param {string} [algorithm] - Hash algorithm override
   * @param {string} [encoding] - Output encoding override
   * @returns {string} Hex-encoded hash
   * @throws {CryptoError} When hashing fails
   */
  hash(data, algorithm, encoding) {
    try {
      const hashAlgorithm = algorithm || this.defaultAlgorithm;
      const outputEncoding = encoding || this.encoding;

      const hash = createHash(hashAlgorithm);
      hash.update(data);
      return hash.digest(outputEncoding);
    } catch (error) {
      throw this._normalizeError(error, 'hash', { algorithm, data: typeof data });
    }
  }

  /**
   * Generate HMAC of data with a key.
   *
   * @param {string} key - Secret key
   * @param {Buffer|Uint8Array|string} data - Data to sign
   * @param {string} [algorithm] - Hash algorithm
   * @param {string} [encoding] - Output encoding
   * @returns {string} HMAC signature
   * @throws {CryptoError} When HMAC generation fails
   */
  hmac(key, data, algorithm, encoding) {
    try {
      const hashAlgorithm = algorithm || this.defaultAlgorithm;
      const outputEncoding = encoding || this.encoding;

      const hmac = createHmac(hashAlgorithm, key);
      hmac.update(data);
      return hmac.digest(outputEncoding);
    } catch (error) {
      throw this._normalizeError(error, 'hmac', { algorithm, data: typeof data });
    }
  }

  /**
   * Generate random bytes.
   *
   * @param {number} size - Number of bytes to generate
   * @param {string} [encoding] - Output encoding (defaults to Buffer)
   * @returns {Buffer|string} Random bytes
   * @throws {CryptoError} When random generation fails
   */
  randomBytes(size, encoding) {
    try {
      const bytes = randomBytes(size);
      return encoding ? bytes.toString(encoding) : bytes;
    } catch (error) {
      throw this._normalizeError(error, 'randomBytes', { size, encoding });
    }
  }

  /**
   * Compare two values in constant time to prevent timing attacks.
   *
   * @param {Buffer|Uint8Array} a - First value
   * @param {Buffer|Uint8Array} b - Second value
   * @returns {boolean} True if values are equal
   * @throws {CryptoError} When comparison fails
   */
  timingSafeEqual(a, b) {
    try {
      return timingSafeEqual(a, b);
    } catch (error) {
      throw this._normalizeError(error, 'timingSafeEqual', {
        aLength: a.length,
        bLength: b.length
      });
    }
  }

  /**
   * Normalize crypto errors into consistent format.
   *
   * @private
   * @param {Error} error - Original error
   * @param {string} operation - Operation that failed
   * @param {Object} context - Operation context
   * @returns {CryptoError} Normalized error
   */
  _normalizeError(error, operation, context = {}) {
    const normalizedError = new Error(
      `Crypto ${operation} failed: ${error.message}`
    );
    normalizedError.name = 'CryptoError';
    normalizedError.code = error.code;
    normalizedError.operation = operation;
    normalizedError.context = context;
    normalizedError.originalError = error;

    return normalizedError;
  }
}
