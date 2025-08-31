/**
 * Tests for CommandRouter
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import CommandRouter from "../src/lib/CommandRouter.js";
import { z } from "zod";

describe("CommandRouter", () => {
  let router;

  beforeEach(() => {
    router = new CommandRouter();
  });

  describe("Basic Routing", () => {
    it("should register and execute a simple command", async () => {
      const handler = vi.fn(async (args) => ({ result: "success", args }));

      router.command("test").handler(handler);

      const result = await router.execute("test", { foo: "bar" });

      expect(handler).toHaveBeenCalledWith(
        { foo: "bar" },
        expect.objectContaining({
          path: "test",
          rawArgs: { foo: "bar" },
        }),
      );
      expect(result).toEqual({ result: "success", args: { foo: "bar" } });
    });

    it("should handle subcommands", async () => {
      const handler = vi.fn(async () => "subcommand executed");

      router.command("parent").subcommand("child").handler(handler);

      const result = await router.execute("parent/child", {});

      expect(handler).toHaveBeenCalled();
      expect(result).toBe("subcommand executed");
    });

    it("should throw error for unregistered commands", async () => {
      await expect(router.execute("nonexistent", {})).rejects.toThrow(
        "No handler registered for command: nonexistent",
      );
    });
  });

  describe("Zod Schema Validation", () => {
    it("should validate arguments with Zod schema", async () => {
      const handler = vi.fn(async (args) => args);

      router
        .command("validate")
        .schema(
          z.object({
            name: z.string(),
            age: z.number().min(0).max(120),
            email: z.string().email().optional(),
          }),
        )
        .handler(handler);

      const result = await router.execute("validate", {
        name: "John",
        age: 30,
        email: "john@example.com",
      });

      expect(handler).toHaveBeenCalledWith(
        {
          name: "John",
          age: 30,
          email: "john@example.com",
        },
        expect.any(Object),
      );
      expect(result).toEqual({
        name: "John",
        age: 30,
        email: "john@example.com",
      });
    });

    it("should apply default values from schema", async () => {
      const handler = vi.fn(async (args) => args);

      router
        .command("defaults")
        .schema(
          z.object({
            verbose: z.boolean().default(false),
            output: z.string().default("console"),
            limit: z.number().default(10),
          }),
        )
        .handler(handler);

      const result = await router.execute("defaults", {});

      expect(result).toEqual({
        verbose: false,
        output: "console",
        limit: 10,
      });
    });

    it("should reject invalid arguments", async () => {
      router
        .command("strict")
        .schema(
          z.object({
            count: z.number().int().positive(),
          }),
        )
        .handler(async () => "should not reach");

      await expect(
        router.execute("strict", { count: "not-a-number" }),
      ).rejects.toThrow("Validation failed");

      await expect(router.execute("strict", { count: -5 })).rejects.toThrow(
        "Validation failed",
      );
    });

    it("should handle enum schemas", async () => {
      const handler = vi.fn(async (args) => args);

      router
        .command("format")
        .schema(
          z.object({
            type: z.enum(["json", "yaml", "xml"]).default("json"),
          }),
        )
        .handler(handler);

      const result = await router.execute("format", { type: "yaml" });
      expect(result.type).toBe("yaml");

      const defaultResult = await router.execute("format", {});
      expect(defaultResult.type).toBe("json");
    });
  });

  describe("CLI Argument Conversion", () => {
    it("should convert kebab-case CLI args to camelCase", async () => {
      const handler = vi.fn(async (args) => args);

      router
        .command("convert")
        .schema(
          z.object({
            firstName: z.string(),
            lastName: z.string(),
            phoneNumber: z.string().optional(),
          }),
        )
        .handler(handler);

      const result = await router.execute("convert", {
        "first-name": "John",
        "last-name": "Doe",
        "phone-number": "555-1234",
      });

      expect(result).toEqual({
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "555-1234",
      });
    });

    it("should handle boolean flags correctly", async () => {
      const handler = vi.fn(async (args) => args);

      router
        .command("flags")
        .schema(
          z.object({
            verbose: z.boolean().default(false),
            quiet: z.boolean().default(false),
            force: z.boolean().default(false),
          }),
        )
        .handler(handler);

      const result = await router.execute("flags", {
        "--verbose": true,
        "--quiet": "false",
        "--force": undefined,
      });

      expect(result).toEqual({
        verbose: true,
        quiet: false,
        force: false,
      });
    });
  });

  describe("Help Generation", () => {
    it("should return help flag when --help is passed", async () => {
      const handler = vi.fn();

      router
        .command("helpful")
        .description("A helpful command")
        .schema(
          z.object({
            input: z.string().describe("Input file path"),
            output: z.string().describe("Output file path"),
          }),
        )
        .handler(handler);

      const result = await router.execute("helpful", { "--help": true });

      expect(result).toEqual({ help: true });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Middleware", () => {
    it("should execute global middleware", async () => {
      const middleware = vi.fn(async (context) => {
        context.args.middlewareRan = true;
      });

      const handler = vi.fn(async (args) => args);

      router.use(middleware);

      router.command("middleware-test").handler(handler);

      const result = await router.execute("middleware-test", { foo: "bar" });

      expect(middleware).toHaveBeenCalled();
      expect(result.middlewareRan).toBe(true);
    });

    it("should execute route-specific middleware", async () => {
      const routeMiddleware = vi.fn(async (context) => {
        context.args.routeSpecific = true;
      });

      const handler = vi.fn(async (args) => args);

      router.command("route-middleware").use(routeMiddleware).handler(handler);

      const result = await router.execute("route-middleware", {});

      expect(routeMiddleware).toHaveBeenCalled();
      expect(result.routeSpecific).toBe(true);
    });
  });

  describe("Pattern Matching", () => {
    it("should match wildcard patterns", async () => {
      const handler = vi.fn(async () => "wildcard matched");

      router.command("api/*").handler(handler);

      const result1 = await router.execute("api/users", {});
      const result2 = await router.execute("api/posts/123", {});

      expect(result1).toBe("wildcard matched");
      expect(result2).toBe("wildcard matched");
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe("Class Handlers", () => {
    it("should support class-based handlers", async () => {
      class TestCommand {
        constructor(config, logger, isProd) {
          this.config = config;
          this.logger = logger;
          this.isProd = isProd;
        }

        async execute(args) {
          return {
            executed: true,
            args,
            hasConfig: !!this.config,
          };
        }
      }

      router.config = { test: "config" };
      router.logger = console;

      router.command("class-handler").handler(TestCommand);

      const result = await router.execute("class-handler", { prod: true });

      expect(result.executed).toBe(true);
      expect(result.hasConfig).toBe(true);
    });
  });

  describe("Common Schemas", () => {
    it("should provide common schema utilities", () => {
      expect(CommandRouter.schemas.verbose).toBeDefined();
      expect(CommandRouter.schemas.quiet).toBeDefined();
      expect(CommandRouter.schemas.force).toBeDefined();
      expect(CommandRouter.schemas.dryRun).toBeDefined();
      expect(CommandRouter.schemas.prod).toBeDefined();
      expect(CommandRouter.schemas.port).toBeDefined();
    });

    it("should validate port numbers correctly", () => {
      const portSchema = CommandRouter.schemas.port;

      expect(portSchema.safeParse(3000).success).toBe(true);
      expect(portSchema.safeParse(80).success).toBe(true);
      expect(portSchema.safeParse(0).success).toBe(false);
      expect(portSchema.safeParse(70000).success).toBe(false);
      expect(portSchema.safeParse("not-a-port").success).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should emit error events on failure", async () => {
      const errorHandler = vi.fn();
      router.on("error", errorHandler);

      router.command("failing").handler(async () => {
        throw new Error("Command failed");
      });

      await expect(router.execute("failing", {})).rejects.toThrow(
        "Command failed",
      );

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "failing",
          error: expect.any(Error),
        }),
      );
    });
  });

  describe("Route Information", () => {
    it("should return registered routes", () => {
      router
        .command("first")
        .description("First command")
        .schema(z.object({ test: z.string() }))
        .handler(async () => {});

      router
        .command("second")
        .subcommand("sub")
        .description("Second command")
        .handler(async () => {});

      const routes = router.getRoutes();

      expect(routes).toHaveLength(2);
      expect(routes[0]).toEqual({
        path: "first",
        hasHandler: true,
        hasSchema: true,
        middleware: 0,
        description: "First command",
      });
      expect(routes[1]).toEqual({
        path: "second/sub",
        hasHandler: true,
        hasSchema: false,
        middleware: 0,
        description: "Second command",
      });
    });
  });
});
