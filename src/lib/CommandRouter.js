/**
 * CommandRouter - Fluent routing system with Zod schema validation
 *
 * Example usage:
 *   const router = new CommandRouter();
 *   const { z } = require('zod');
 *
 *   router
 *     .command("migrate")
 *     .subcommand("generate")
 *     .schema(z.object({
 *       name: z.string().describe("Migration name"),
 *       type: z.enum(["up", "down", "both"]).default("up").describe("Migration type"),
 *       batchSize: z.number().min(1).max(1000).optional().describe("Records per batch"),
 *       verbose: z.boolean().default(false).describe("Enable verbose output"),
 *       outputDir: z.string().describe("Output directory")
 *     }))
 *     .handler(async (args) => {
 *       // args is fully typed and validated
 *       return new GenerateCommand().execute(args);
 *     });
 */

const EventEmitter = require("events");
const { z } = require("zod");

class CommandRouter extends EventEmitter {
  constructor() {
    super();
    this.routes = new Map();
    this.globalMiddleware = [];
  }

  /**
   * Start building a new command
   * @param {string} name - The command name
   * @returns {CommandBuilder} Fluent builder for command configuration
   */
  command(name) {
    return new CommandBuilder(this, name);
  }

  /**
   * Register a built command route
   * @private
   */
  registerRoute(path, config) {
    this.routes.set(path, config);
    this.emit("route:registered", { path, config });
  }

  /**
   * Add global middleware that runs for all commands
   * @param {Function} middleware - Middleware function
   * @returns {CommandRouter} For chaining
   */
  use(middleware) {
    this.globalMiddleware.push(middleware);
    return this;
  }

  /**
   * Execute a command based on the given path and arguments
   * @param {string} commandPath - The command path (e.g., "migrate/generate")
   * @param {Object} rawArgs - Raw command arguments
   * @returns {Promise<any>} Command execution result
   */
  async execute(commandPath, rawArgs = {}) {
    const route = this.findRoute(commandPath);

    if (!route) {
      throw new Error(`No handler registered for command: ${commandPath}`);
    }

    // Check for help flag first
    if (rawArgs["--help"] || rawArgs["-h"] || rawArgs.help) {
      this.showHelp(commandPath, route);
      return { help: true };
    }

    // Create a context object for this execution
    const context = {
      path: commandPath,
      rawArgs,
      route,
      router: this,
    };

    try {
      // Run global middleware
      await Promise.all(
        this.globalMiddleware.map((middleware) => middleware(context)),
      );

      // Parse and validate arguments with Zod schema
      let parsedArgs = rawArgs;
      if (route.schema) {
        // Convert CLI args to match schema shape
        const argsToValidate = this.prepareArgsForSchema(rawArgs, route);

        // Validate with Zod
        const result = await route.schema.safeParseAsync(argsToValidate);

        if (!result.success) {
          const errors = result.error.format();
          this.showValidationErrors(commandPath, errors, route);
          throw new Error("Validation failed");
        }

        parsedArgs = result.data;
      }

      context.args = parsedArgs;

      // Run route-specific middleware
      await Promise.all(
        route.middleware.map((middleware) => middleware(context)),
      );

      // Execute the handler
      if (!route.handler) {
        throw new Error(`No handler defined for command: ${commandPath}`);
      }

      return await route.handler(parsedArgs, context);
    } catch (error) {
      this.emit("error", { path: commandPath, error });
      throw error;
    }
  }

  /**
   * Prepare raw CLI arguments for Zod schema validation
   * Maps CLI conventions (--kebab-case) to schema properties (camelCase)
   * @private
   */
  prepareArgsForSchema(rawArgs, route) {
    const prepared = {};

    for (const [key, value] of Object.entries(rawArgs)) {
      // Skip special args
      if (key === "_" || key === "$0") continue;

      // Convert --kebab-case to camelCase
      const propName = key
        .replace(/^-+/, "")
        .replace(/-([a-z])/g, (g) => g[1].toUpperCase());

      // Handle boolean flags (presence = true)
      if (value === true || value === undefined) {
        prepared[propName] = true;
      } else if (value === "true") {
        prepared[propName] = true;
      } else if (value === "false") {
        prepared[propName] = false;
      } else {
        prepared[propName] = value;
      }
    }

    // Apply any custom mappings from route config
    if (route.argMappings) {
      for (const [from, to] of Object.entries(route.argMappings)) {
        if (rawArgs[from] !== undefined) {
          prepared[to] = rawArgs[from];
        }
      }
    }

    return prepared;
  }

  /**
   * Show auto-generated help for a command
   * @private
   */
  showHelp(commandPath, route) {
    const parts = commandPath.split("/");
    const commandName = parts.join(" ");

    console.log(`\nUsage: data ${commandName} [OPTIONS]\n`);

    if (route.description) {
      console.log(`${route.description}\n`);
    }

    if (route.schema) {
      console.log("Options:");

      // Extract schema shape for help generation
      const shape = route.schema._def.shape || route.schema.shape || {};

      for (const [key, field] of Object.entries(shape)) {
        let line = "  ";

        // Convert camelCase to kebab-case for CLI
        const cliName = key.replace(
          /[A-Z]/g,
          (letter) => `-${letter.toLowerCase()}`,
        );
        line += `--${cliName}`;

        // Get type from Zod schema
        const typeName = this.getZodTypeName(field);
        if (typeName !== "boolean") {
          line += ` <${typeName}>`;
        }

        // Add description if available
        const description = field.description || field._def?.description;
        if (description) {
          line = line.padEnd(30) + description;
        }

        // Add constraints
        const constraints = this.getZodConstraints(field);
        if (constraints.length > 0) {
          line += ` (${constraints.join(", ")})`;
        }

        console.log(line);
      }
    }

    if (route.examples && route.examples.length > 0) {
      console.log("\nExamples:");
      for (const example of route.examples) {
        console.log(`  ${example}`);
      }
    }

    console.log("");
  }

  /**
   * Get human-readable type name from Zod schema
   * @private
   */
  getZodTypeName(schema) {
    const def = schema._def;

    if (def.typeName === "ZodString") return "string";
    if (def.typeName === "ZodNumber") return "number";
    if (def.typeName === "ZodBoolean") return "boolean";
    if (def.typeName === "ZodArray") return "array";
    if (def.typeName === "ZodEnum") return "choice";
    if (def.typeName === "ZodOptional")
      return this.getZodTypeName(def.innerType);
    if (def.typeName === "ZodDefault")
      return this.getZodTypeName(def.innerType);
    if (def.typeName === "ZodNullable")
      return this.getZodTypeName(def.innerType);

    return "value";
  }

  /**
   * Extract constraints from Zod schema for help text
   * @private
   */
  getZodConstraints(schema) {
    const constraints = [];
    const def = schema._def;

    // Check if optional
    if (def.typeName === "ZodOptional") {
      constraints.push("optional");
      return [...constraints, ...this.getZodConstraints(def.innerType)];
    }

    // Check for default
    if (def.typeName === "ZodDefault") {
      const defaultValue = def.defaultValue();
      constraints.push(`default: ${JSON.stringify(defaultValue)}`);
      return [...constraints, ...this.getZodConstraints(def.innerType)];
    }

    // String constraints
    if (def.typeName === "ZodString") {
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === "min")
            constraints.push(`min length: ${check.value}`);
          if (check.kind === "max")
            constraints.push(`max length: ${check.value}`);
          if (check.kind === "regex")
            constraints.push(`pattern: ${check.regex}`);
        }
      }
    }

    // Number constraints
    if (def.typeName === "ZodNumber") {
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === "min") constraints.push(`min: ${check.value}`);
          if (check.kind === "max") constraints.push(`max: ${check.value}`);
          if (check.kind === "int") constraints.push("integer");
        }
      }
    }

    // Enum values
    if (def.typeName === "ZodEnum") {
      constraints.push(`values: ${def.values.join(", ")}`);
    }

    return constraints;
  }

  /**
   * Show validation errors in a user-friendly format
   * @private
   */
  showValidationErrors(commandPath, errors, _route) {
    console.error(`\nValidation errors for command: ${commandPath}\n`);

    // Remove the _errors property which is just metadata
    delete errors._errors;

    for (const [field, fieldErrors] of Object.entries(errors)) {
      if (fieldErrors._errors && fieldErrors._errors.length > 0) {
        const cliName = field.replace(
          /[A-Z]/g,
          (letter) => `-${letter.toLowerCase()}`,
        );
        console.error(`  --${cliName}: ${fieldErrors._errors.join(", ")}`);
      }
    }

    console.error("\nRun with --help for usage information\n");
  }

  /**
   * Find a route that matches the given path
   * @private
   */
  findRoute(commandPath) {
    // Direct match
    if (this.routes.has(commandPath)) {
      return this.routes.get(commandPath);
    }

    // Try to match with wildcards
    for (const [pattern, config] of this.routes) {
      if (this.matchesPattern(commandPath, pattern)) {
        return config;
      }
    }

    return null;
  }

  /**
   * Check if a command path matches a pattern
   * @private
   */
  matchesPattern(path, pattern) {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return regex.test(path);
    }
    return path === pattern;
  }

  /**
   * Get all registered routes (useful for help/debugging)
   */
  getRoutes() {
    return Array.from(this.routes.entries()).map(([path, config]) => ({
      path,
      hasHandler: !!config.handler,
      hasSchema: !!config.schema,
      middleware: config.middleware.length,
      description: config.description,
    }));
  }
}

/**
 * Fluent builder for command configuration
 */
class CommandBuilder {
  constructor(router, name) {
    this.router = router;
    this.path = name;
    this.config = {
      handler: null,
      schema: null,
      middleware: [],
      description: "",
      examples: [],
      argMappings: {},
    };
  }

  /**
   * Add a subcommand to the path
   * @param {string} name - Subcommand name
   * @returns {CommandBuilder} For chaining
   */
  subcommand(name) {
    this.path = `${this.path}/${name}`;
    return this;
  }

  /**
   * Set the Zod schema for argument validation
   * @param {z.ZodSchema} schema - Zod schema
   * @returns {CommandBuilder} For chaining
   */
  schema(schema) {
    this.config.schema = schema;
    return this;
  }

  /**
   * Map CLI argument names to schema property names
   * @param {Object} mappings - Object mapping CLI names to schema names
   * @returns {CommandBuilder} For chaining
   */
  mapArgs(mappings) {
    this.config.argMappings = { ...this.config.argMappings, ...mappings };
    return this;
  }

  /**
   * Set command description
   * @param {string} description - Command description
   * @returns {CommandBuilder} For chaining
   */
  description(description) {
    this.config.description = description;
    return this;
  }

  /**
   * Add usage examples
   * @param {...string} examples - Example commands
   * @returns {CommandBuilder} For chaining
   */
  examples(...examples) {
    this.config.examples = examples;
    return this;
  }

  /**
   * Add middleware for this specific route
   * @param {Function} middleware - Middleware function
   * @returns {CommandBuilder} For chaining
   */
  use(middleware) {
    this.config.middleware.push(middleware);
    return this;
  }

  /**
   * Set the command handler and register the route
   * @param {Function|Class} handler - Command handler function or class
   * @returns {CommandRouter} The parent router for further configuration
   */
  handler(handler) {
    // Support both function handlers and class handlers
    if (
      typeof handler === "function" &&
      handler.prototype &&
      handler.prototype.execute
    ) {
      // It's a class - wrap it
      this.config.handler = async (args, context) => {
        const instance = new handler(
          context.router.config,
          context.router.logger,
          args.prod,
        );

        // Forward events from subcommand to router
        if (instance.on) {
          [
            "start",
            "progress",
            "warning",
            "error",
            "success",
            "complete",
            "failed",
            "cancelled",
            "prompt",
          ].forEach((event) => {
            instance.on(event, (data) => context.router.emit(event, data));
          });
        }

        return await instance.execute(args);
      };
    } else {
      this.config.handler = handler;
    }

    this.router.registerRoute(this.path, this.config);
    return this.router;
  }

  /**
   * Alternative to handler() - register route without handler (for grouping)
   * @returns {CommandRouter} The parent router
   */
  register() {
    this.router.registerRoute(this.path, this.config);
    return this.router;
  }
}

// Export common Zod schemas for CLI use
CommandRouter.schemas = {
  // Common CLI argument types
  port: z.number().int().min(1).max(65535),

  url: z.string().url(),

  email: z.string().email(),

  path: z.string(),

  existingPath: z.string().refine(
    (val) => {
      const fs = require("fs");
      try {
        fs.accessSync(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Path does not exist" },
  ),

  directory: z.string().refine(
    (val) => {
      const fs = require("fs");
      try {
        const stats = fs.statSync(val);
        return stats.isDirectory();
      } catch {
        return false;
      }
    },
    { message: "Path must be a directory" },
  ),

  file: z.string().refine(
    (val) => {
      const fs = require("fs");
      try {
        const stats = fs.statSync(val);
        return stats.isFile();
      } catch {
        return false;
      }
    },
    { message: "Path must be a file" },
  ),

  // Common flag combinations
  verbose: z.boolean().default(false).describe("Enable verbose output"),

  quiet: z.boolean().default(false).describe("Suppress output"),

  force: z
    .boolean()
    .default(false)
    .describe("Force operation without confirmation"),

  dryRun: z
    .boolean()
    .default(false)
    .describe("Preview changes without applying them"),

  prod: z.boolean().default(false).describe("Target production environment"),
};

module.exports = CommandRouter;
