/**
 * LoggerConsoleAdapter - Console-based implementation of LoggerPort
 */
export class LoggerConsoleAdapter {
  constructor(bindings = {}) {
    this.bindings = bindings;
  }

  info(obj, msg) {
    const output = this._format('INFO', obj, msg);
    console.log(output);
  }

  warn(obj, msg) {
    const output = this._format('WARN', obj, msg);
    console.warn(output);
  }

  error(obj, msg) {
    const output = this._format('ERROR', obj, msg);
    console.error(output);
  }

  debug(obj, msg) {
    if (process.env.DEBUG) {
      const output = this._format('DEBUG', obj, msg);
      console.debug(output);
    }
  }

  child(bindings) {
    return new LoggerConsoleAdapter({ ...this.bindings, ...bindings });
  }

  _format(level, obj, msg) {
    const parts = [];
    if (Object.keys(this.bindings).length > 0) {
      parts.push(JSON.stringify(this.bindings));
    }
    if (msg) parts.push(msg);
    if (obj) parts.push(JSON.stringify(obj));
    return parts.join(' ');
  }
}