/**
 * EventBusNodeAdapter - Node.js EventEmitter implementation of EventBusPort
 */
import { EventEmitter } from 'node:events';

export class EventBusNodeAdapter {
  constructor() {
    this.emitter = new EventEmitter();
  }

  on(type, handler) {
    this.emitter.on(type, handler);
    // Return unsubscribe function
    return () => this.off(type, handler);
  }

  off(type, handler) {
    this.emitter.off(type, handler);
  }

  emit(type, payload) {
    this.emitter.emit(type, payload);
  }

  once(type, handler) {
    this.emitter.once(type, handler);
  }
}
