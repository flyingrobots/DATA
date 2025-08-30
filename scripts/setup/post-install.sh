#!/bin/bash

# data Post-install Script
# Sets up git hooks by creating symlinks

echo "=' data Post-install Setup"
echo "=========================="

# Get the root directory of the git repository
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -z "$GIT_ROOT" ]; then
  echo "L Error: Not in a git repository"
  exit 1
fi

echo "=� Git root: $GIT_ROOT"

# Check if .git/hooks directory exists
if [ ! -d "$GIT_ROOT/.git/hooks" ]; then
  echo "L Error: .git/hooks directory not found"
  exit 1
fi

# Function to create symlink for a hook
create_hook_symlink() {
  local hook_name=$1
  local source_path="$GIT_ROOT/scripts/git/hooks/${hook_name}.sh"
  local target_path="$GIT_ROOT/.git/hooks/${hook_name}"
  
  if [ ! -f "$source_path" ]; then
    echo "�  Skipping $hook_name: source file not found"
    return
  fi
  
  # Remove existing hook if it exists
  if [ -e "$target_path" ]; then
    if [ -L "$target_path" ]; then
      echo "= Updating existing symlink for $hook_name"
      rm "$target_path"
    else
      echo "�  Warning: $hook_name exists and is not a symlink. Backing up to ${hook_name}.backup"
      mv "$target_path" "${target_path}.backup"
    fi
  fi
  
  # Create the symlink
  ln -s "$source_path" "$target_path"
  
  # Make the hook executable
  chmod +x "$source_path"
  
  echo " Created symlink for $hook_name"
}

echo ""
echo "= Setting up git hooks..."

# Create symlinks for all hooks
create_hook_symlink "pre-commit"

# Add more hooks as needed:
# create_hook_symlink "pre-push"
# create_hook_symlink "commit-msg"

echo ""
echo "<� Git hooks setup complete!"
echo ""
echo "=� Installed hooks:"
ls -la "$GIT_ROOT/.git/hooks/" | grep -E "pre-commit|pre-push|commit-msg" | grep -v backup

echo ""
echo "=� Tips:"
echo "  - Pre-commit hook will run ESLint on staged JavaScript files"
echo "  - Run 'npm run lint' to check all files manually"
echo "  - Run 'npm run lint:fix' to auto-fix issues"
echo "  - Bypass hooks with 'git commit --no-verify' (use sparingly!)"