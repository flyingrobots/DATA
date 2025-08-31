/**
 * LoggerPort - Interface for structured logging
 * Pure interface definition - no implementation
 * @typedef {Object} LoggerPort
 * @property {(obj?: any, msg?: string) => void} info - Log info level
 * @property {(obj?: any, msg?: string) => void} warn - Log warning level
 * @property {(obj?: any, msg?: string) => void} error - Log error level
 * @property {(obj?: any, msg?: string) => void} debug - Log debug level
 * @property {(bindings: Record<string, any>) => LoggerPort} child - Create child logger with bindings
 */

export {};