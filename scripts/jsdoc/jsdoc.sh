#!/bin/bash

# D.A.T.A. JSDoc Generation Manual Script
# Provides easy command-line interface for JSDoc generation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}🖖 D.A.T.A. JSDoc Generator${NC}"
echo "Generate comprehensive JSDoc documentation for JavaScript files"
echo ""

# Function to show usage
show_usage() {
    echo "Usage: $0 [options] [files...]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -v, --verbose       Verbose output"
    echo "  -d, --dry-run       Show what would be changed without making changes"
    echo "  -f, --force         Process files even if they already have JSDoc"
    echo "  -a, --all           Process all JavaScript files in src/, bin/, scripts/"
    echo "  -s, --src           Process only src/ directory files"
    echo "  -b, --bin           Process only bin/ directory files"
    echo "  --scripts           Process only scripts/ directory files"
    echo ""
    echo "Examples:"
    echo "  $0 --all                           # Process all JavaScript files"
    echo "  $0 --src --verbose                 # Process src/ files with verbose output"
    echo "  $0 src/lib/Command.js              # Process specific file"
    echo "  $0 --dry-run --all                 # Preview changes without making them"
    echo "  $0 --force src/commands/db/*.js    # Force process specific files"
    echo ""
    echo "Environment Variables:"
    echo "  SKIP_AI=true          Skip AI generation, use heuristic approach only"
    echo "  CLAUDE_TIMEOUT=60     Timeout for Claude API calls (seconds)"
    echo ""
}

# Parse command line arguments
VERBOSE=false
DRY_RUN=false
FORCE=false
PROCESS_ALL=false
PROCESS_SRC=false
PROCESS_BIN=false
PROCESS_SCRIPTS=false
FILES=()

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -a|--all)
            PROCESS_ALL=true
            shift
            ;;
        -s|--src)
            PROCESS_SRC=true
            shift
            ;;
        -b|--bin)
            PROCESS_BIN=true
            shift
            ;;
        --scripts)
            PROCESS_SCRIPTS=true
            shift
            ;;
        -*)
            echo -e "${RED}Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
        *)
            FILES+=("$1")
            shift
            ;;
    esac
done

# Change to root directory
cd "$ROOT_DIR"

# Collect files to process
TARGETS=()

if [ "$PROCESS_ALL" = true ] || [ "$PROCESS_SRC" = true ]; then
    if [ -d "src" ]; then
        while IFS= read -r -d '' file; do
            TARGETS+=("$file")
        done < <(find src -name "*.js" -type f -print0)
    fi
fi

if [ "$PROCESS_ALL" = true ] || [ "$PROCESS_BIN" = true ]; then
    if [ -d "bin" ]; then
        while IFS= read -r -d '' file; do
            TARGETS+=("$file")
        done < <(find bin -name "*.js" -type f -print0)
    fi
fi

if [ "$PROCESS_ALL" = true ] || [ "$PROCESS_SCRIPTS" = true ]; then
    if [ -d "scripts" ]; then
        while IFS= read -r -d '' file; do
            TARGETS+=("$file")
        done < <(find scripts -name "*.js" -type f -print0)
    fi
fi

# Add specific files from command line
for file in "${FILES[@]}"; do
    if [[ "$file" == *.js ]] && [ -f "$file" ]; then
        TARGETS+=("$file")
    elif [ -f "$file" ]; then
        echo -e "${YELLOW}Warning: $file is not a JavaScript file, skipping${NC}"
    else
        echo -e "${YELLOW}Warning: $file not found, skipping${NC}"
    fi
done

# Remove duplicates
UNIQUE_TARGETS=($(printf '%s\n' "${TARGETS[@]}" | sort -u))

if [ ${#UNIQUE_TARGETS[@]} -eq 0 ]; then
    echo -e "${YELLOW}No JavaScript files found to process.${NC}"
    echo ""
    echo "Try one of these options:"
    echo "  $0 --all                    # Process all files"
    echo "  $0 --src                    # Process src/ directory"
    echo "  $0 src/lib/Command.js       # Process specific file"
    echo ""
    exit 1
fi

echo -e "${GREEN}Found ${#UNIQUE_TARGETS[@]} JavaScript files to process${NC}"

# Show files if verbose or dry run
if [ "$VERBOSE" = true ] || [ "$DRY_RUN" = true ]; then
    echo ""
    echo "Files to process:"
    printf '  %s\n' "${UNIQUE_TARGETS[@]}"
    echo ""
fi

# Build node command arguments
NODE_ARGS=()

if [ "$VERBOSE" = true ]; then
    NODE_ARGS+=("--verbose")
fi

if [ "$DRY_RUN" = true ]; then
    NODE_ARGS+=("--dry-run")
fi

if [ "$FORCE" = true ]; then
    NODE_ARGS+=("--force")
fi

# Add all target files
NODE_ARGS+=("${UNIQUE_TARGETS[@]}")

# Show what we're about to do
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}DRY RUN: Would execute:${NC}"
    echo "node scripts/jsdoc/generate-jsdoc.js ${NODE_ARGS[*]}"
    echo ""
else
    echo -e "${BLUE}Executing JSDoc generation...${NC}"
fi

# Execute the JSDoc generator
node scripts/jsdoc/generate-jsdoc.js "${NODE_ARGS[@]}"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ JSDoc generation completed successfully!${NC}"
    
    if [ "$DRY_RUN" = false ]; then
        echo ""
        echo -e "${BLUE}💡 Tips:${NC}"
        echo "  • Run with --dry-run to preview changes"
        echo "  • Use --verbose for detailed output"
        echo "  • Set SKIP_AI=true to use heuristic generation only"
        echo "  • JSDoc generation runs automatically on git commits"
    fi
else
    echo -e "${RED}❌ JSDoc generation failed with exit code $EXIT_CODE${NC}"
fi

exit $EXIT_CODE