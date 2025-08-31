# Test Configuration

data supports comprehensive test configuration through `.datarc.json` files, allowing you to customize test behavior, coverage requirements, and automation settings.

## Configuration Location

Configuration files are loaded in the following order of precedence:

1. Command-line specified config path
2. `.datarc.json` in current working directory
3. `.datarc` in current working directory
4. `.datarc.json` in home directory
5. `.datarc` in home directory
6. Default configuration (if no file found)

## Test Configuration Schema

The `test` section in your configuration file supports the following options:

```json
{
  "test": {
    "minimum_coverage": 80,
    "test_timeout": 300,
    "parallel_execution": false,
    "output_formats": ["console", "junit", "json"],
    "coverage_enforcement": true,
    "excluded_functions": ["internal_*", "migration_*"],
    "debounce_delay": 1000,
    "auto_compile": true
  }
}
```

### Configuration Options

| Option                 | Type             | Default                         | Description                                           |
| ---------------------- | ---------------- | ------------------------------- | ----------------------------------------------------- |
| `minimum_coverage`     | Number (0-100)   | 80                              | Minimum test coverage percentage required             |
| `test_timeout`         | Number (seconds) | 300                             | Maximum time allowed for individual test execution    |
| `parallel_execution`   | Boolean          | false                           | Whether to run tests in parallel (future feature)     |
| `output_formats`       | Array            | `["console", "junit", "json"]`  | Available output formats for test results             |
| `coverage_enforcement` | Boolean          | true                            | Whether to enforce coverage thresholds by default     |
| `excluded_functions`   | Array            | `["internal_*", "migration_*"]` | Function patterns to exclude from coverage            |
| `debounce_delay`       | Number (ms)      | 1000                            | Delay before re-running tests in watch mode           |
| `auto_compile`         | Boolean          | true                            | Whether to automatically compile tests before running |

## Command Integration

### RunCommand

The `RunCommand` uses test configuration for:

- **Test Timeout**: Sets query timeout based on `test_timeout` setting
- **Output Format**: Defaults to first format in `output_formats` array
- **Format Selection**: Validates output format against allowed formats

Example usage:

```bash
# Uses config default output format
./build/data test run

# Override config with specific format
./build/data test run --format junit
```

### CoverageCommand

The `CoverageCommand` integrates with:

- **Coverage Enforcement**: Uses `coverage_enforcement` as default for --enforce
- **Minimum Coverage**: Uses `minimum_coverage` for threshold validation
- **Excluded Functions**: Respects `excluded_functions` patterns

Example usage:

```bash
# Uses config enforcement and coverage settings
./build/data test coverage

# Override config settings
./build/data test coverage --enforce --min-coverage 90
```

### WatchCommand

The `WatchCommand` respects:

- **Debounce Delay**: Uses `debounce_delay` for file change debouncing
- **Auto Compile**: Uses `auto_compile` to determine if tests should be compiled automatically

Example usage:

```bash
# Uses config debounce and auto-compile settings
./build/data test watch

# Override debounce delay
./build/data test watch --debounce 2000
```

### DevCycleCommand

The `DevCycleCommand` integrates configuration by:

- Loading test config to respect all settings
- Passing configuration context to child commands
- Using configured timeouts and enforcement settings

## Configuration Validation

D.A.T.A. automatically validates and sanitizes configuration values:

### Validation Rules

- **minimum_coverage**: Must be 0-100, defaults to 80 for invalid values
- **test_timeout**: Must be positive number, defaults to 300 for invalid values
- **parallel_execution**: Must be boolean, defaults to false for invalid values
- **output_formats**: Must be array of valid formats, filters invalid formats
- **coverage_enforcement**: Must be boolean, defaults to true for invalid values
- **excluded_functions**: Must be array, defaults to `["internal_*", "migration_*"]`
- **debounce_delay**: Must be non-negative number, defaults to 1000 for invalid values
- **auto_compile**: Must be boolean, defaults to true for invalid values

### Type Coercion

String values are automatically converted to appropriate types:

```json
{
  "test": {
    "minimum_coverage": "85", // → 85 (number)
    "test_timeout": "600", // → 600 (number)
    "coverage_enforcement": "true" // → true (boolean)
  }
}
```

Invalid values fallback to defaults:

```json
{
  "test": {
    "minimum_coverage": "invalid", // → 80 (default)
    "test_timeout": -10, // → 300 (default)
    "debounce_delay": "fast" // → 1000 (default)
  }
}
```

## Example Configuration Files

### Development Configuration

```json
{
  "test": {
    "minimum_coverage": 70,
    "test_timeout": 600,
    "coverage_enforcement": false,
    "debounce_delay": 500,
    "auto_compile": true,
    "output_formats": ["console"]
  }
}
```

### Production/CI Configuration

```json
{
  "test": {
    "minimum_coverage": 90,
    "test_timeout": 300,
    "coverage_enforcement": true,
    "parallel_execution": false,
    "output_formats": ["junit", "json"],
    "excluded_functions": ["internal_*", "migration_*", "debug_*"]
  }
}
```

### Minimal Configuration

```json
{
  "test": {
    "minimum_coverage": 80
  }
}
```

_All other settings will use defaults_

## Environment Integration

Test configuration works seamlessly with data's environment system:

```json
{
  "environments": {
    "local": {
      "db": "postgresql://postgres:postgres@127.0.0.1:54332/postgres"
    }
  },
  "test": {
    "minimum_coverage": 80,
    "coverage_enforcement": true
  }
}
```

## Command Line Overrides

Configuration settings can be overridden via command-line options:

```bash
# Override coverage settings
./build/data test coverage --enforce --min-coverage 95

# Override output format
./build/data test run --format json --output results.json

# Override watch settings
./build/data test watch --debounce 2000 --no-auto-compile
```

Command-line options always take precedence over configuration file settings.

## Troubleshooting

### Configuration Not Loading

```bash
# Check if config file exists and is valid JSON
cat .datarc.json | jq .

# Verify config loading with debug output
DEBUG=data:config ./build/data test run
```

### Invalid Configuration Values

D.A.T.A. will automatically fix invalid values and continue execution. Check logs for validation warnings:

```
WARN: Invalid minimum_coverage "invalid", using default 80
WARN: Invalid test_timeout -10, using default 300
```

### Configuration Precedence Issues

When multiple config files exist, check the loading order:

1. Current directory `.datarc.json`
2. Home directory `.datarc.json`
3. Default configuration

Use absolute paths to specify exact config file location.
