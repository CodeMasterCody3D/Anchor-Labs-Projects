#!/usr/bin/env bash
set -e

echo -e "\x1b[1m\x1b[36m=====================================================\x1b[0m"
echo -e "\x1b[1m\x1b[36m  ANCHOR-LABS-PROJECTS INSTALLATION WIZARD\x1b[0m"
echo -e "\x1b[1m\x1b[36m=====================================================\x1b[0m"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="${HOME}/.project-anchor"
BIN_DIR="${HOME}/.local/bin"

# 1. Check Node
if ! command -v node &>/dev/null; then
  echo -e "\x1b[31m✖ Error: Node.js is required but not installed.\x1b[0m"
  exit 1
fi
echo -e "\x1b[32m✔ Node.js detected:\x1b[0m $(node -v)"

# 2. Check Tmux
if ! command -v tmux &>/dev/null; then
  echo -e "\x1b[33m⚠ Warning: tmux is not installed. Background worker daemon requires tmux.\x1b[0m"
  echo "  Install via: sudo apt install tmux"
else
  echo -e "\x1b[32m✔ tmux detected:\x1b[0m $(tmux -V)"
fi

# 3. Create Runtime Dirs
mkdir -p "${RUNTIME_DIR}/graphs"
mkdir -p "${BIN_DIR}"

# 4. Symlink CLI
chmod +x "${REPO_DIR}/bin/project-anchor"
chmod +x "${REPO_DIR}/server/"*.js
chmod +x "${REPO_DIR}/daemon/"*.js
chmod +x "${REPO_DIR}/claude-plugin/hooks/"*.js

ln -sf "${REPO_DIR}/bin/project-anchor" "${BIN_DIR}/anchor-labs-projects"
ln -sf "${REPO_DIR}/bin/project-anchor" "${BIN_DIR}/project-anchor"
echo -e "\x1b[32m✔ Symlinked CLIs:\x1b[0m ${BIN_DIR}/anchor-labs-projects, ${BIN_DIR}/project-anchor"

# 5. Install Claude Code Skills
CLAUDE_SKILLS_DIR="${HOME}/.claude/skills/project-anchor"
mkdir -p "${CLAUDE_SKILLS_DIR}"
cp -r "${REPO_DIR}/claude-plugin/skills/"* "${CLAUDE_SKILLS_DIR}/"
echo -e "\x1b[32m✔ Claude Code slash commands installed to:\x1b[0m ${CLAUDE_SKILLS_DIR}"

# 6. Verify Installation
echo -e "\n\x1b[1mRunning health verification...\x1b[0m"
"${REPO_DIR}/bin/project-anchor" doctor

echo -e "\x1b[32m✔ Anchor-Labs-Projects successfully installed!\x1b[0m"
echo "  Run 'anchor-labs-projects status' or 'anchor-labs-projects help' to get started."
