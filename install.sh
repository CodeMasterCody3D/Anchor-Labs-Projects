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

# Helper: Check and auto-install tmux (Arch Linux, Ubuntu/Debian, Fedora, macOS)
ensure_tmux() {
  if command -v tmux >/dev/null 2>&1; then
    echo -e "\x1b[32m✔ tmux detected:\x1b[0m $(tmux -V)"
    return 0
  fi

  echo -e "\x1b[33m⚠ tmux is required for background worker daemon monitoring.\x1b[0m"
  echo "Attempting automatic installation..."

  local INSTALL_CMD=""
  local PKG_MANAGER=""

  if command -v pacman >/dev/null 2>&1; then
    PKG_MANAGER="pacman (Arch Linux)"
    INSTALL_CMD="pacman -S --noconfirm tmux"
  elif command -v apt-get >/dev/null 2>&1; then
    PKG_MANAGER="apt (Ubuntu/Debian)"
    INSTALL_CMD="apt-get update -qq && apt-get install -y tmux"
  elif command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf (Fedora/RHEL)"
    INSTALL_CMD="dnf install -y tmux"
  elif command -v zypper >/dev/null 2>&1; then
    PKG_MANAGER="zypper (openSUSE)"
    INSTALL_CMD="zypper install -y tmux"
  elif command -v apk >/dev/null 2>&1; then
    PKG_MANAGER="apk (Alpine)"
    INSTALL_CMD="apk add tmux"
  elif command -v brew >/dev/null 2>&1; then
    PKG_MANAGER="brew (Homebrew)"
    INSTALL_CMD="brew install tmux"
  fi

  if [ -z "$INSTALL_CMD" ]; then
    echo -e "\x1b[31m✖ Unsupported package manager. Please install tmux manually (e.g. 'sudo pacman -S tmux' or 'sudo apt install tmux').\x1b[0m" >&2
    return 1
  fi

  echo "Detected package manager: ${PKG_MANAGER}"

  if [ "$(id -u)" -eq 0 ]; then
    eval "$INSTALL_CMD"
  else
    if command -v sudo >/dev/null 2>&1; then
      echo "Requesting sudo permissions to install tmux..."
      eval "sudo $INSTALL_CMD"
    else
      echo -e "\x1b[31m✖ 'sudo' not available. Please run: '$INSTALL_CMD' as root.\x1b[0m" >&2
      return 1
    fi
  fi

  if command -v tmux >/dev/null 2>&1; then
    echo -e "\x1b[32m✔ Successfully installed tmux:\x1b[0m $(tmux -V)"
  else
    echo -e "\x1b[31m✖ Failed to verify tmux installation. Please install tmux manually.\x1b[0m" >&2
    return 1
  fi
}

# 2. Check Tmux
ensure_tmux

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
