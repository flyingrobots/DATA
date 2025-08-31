/**
 * EventBusPort - Interface for event publishing/subscribing
 * Pure interface definition - no implementation
 * @typedef {Object} EventBusPort
 * @property {(type: string, handler: (payload: any) => void) => () => void} on - Subscribe to event, returns unsubscribe function
 * @property {(type: string, handler: (payload: any) => void) => void} off - Unsubscribe from event
 * @property {(type: string, payload: any) => void} emit - Emit event
 * @property {(type: string, handler: (payload: any) => void) => void} once - Subscribe to event once
 */

export {};