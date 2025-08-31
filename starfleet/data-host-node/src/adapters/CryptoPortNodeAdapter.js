/**
 * CryptoPortNodeAdapter - Node.js crypto implementation of CryptoPort
 */
import { createHash, randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';

export class CryptoPortNodeAdapter {
  hash(data, algorithm = 'sha256') {
    return createHash(algorithm).update(data).digest('hex');
  }

  randomUUID() {
    return randomUUID();
  }

  randomBytes(length) {
    return randomBytes(length).toString('hex');
  }

  timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return timingSafeEqual(bufA, bufB);
  }
}