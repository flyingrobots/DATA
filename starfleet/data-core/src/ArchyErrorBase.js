/**
 * Custom error class for data-related errors.
 * Includes error code and context for better debugging.
 * @class dataErrorBase
 * @extends Error
 */
export class dataErrorBase extends Error {
    /**
     * Constructor for dataError
     * @param {string} message Error message
     * @param {number} code Error code
     * @param {object} context Contextual information about the error
     * @constructor
     */
    constructor(message, code, context = {}) {
        if (new.target === dataErrorBase) {
            throw new TypeError("Cannot construct dataErrorBase instances directly");
        }

        if (typeof code !== 'number') {
            throw new TypeError("Error code must be a number");
        }

        if (typeof message !== 'string' || message.trim() === '') {
            throw new TypeError("Error message must be a non-empty string");
        }

        super(message);

        this.name = this.constructor.name;
        this.timestamp = new Date().toISOString();
        this.code = code;
        this.context = context;
    }

    /**
     * Error code associated with the error
     * @returns {number} Error code
     */
    getCode() {
        return this.code;
    }

    /**
     * Contextual information about the error
     * @returns {object} Context
     */
    getContext() {
        return this.context;
    }
    
    /**
     * Timestamp when the error was created
     * @returns {string} ISO timestamp
     */
    getTimestamp() {
        return this.timestamp;
    }
    
    /**
     * Error message
     * @returns {string} Error message
     */
    getMessage() {
        return this.message;
    }
}

export default dataErrorBase;