#!/usr/bin/env node
const { execSync } = require('child_process');

let input = '';
process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    let commandLine = '';
    try {
      const parsed = JSON.parse(input);
      commandLine = (parsed.tool_input && (parsed.tool_input.command || parsed.tool_input.CommandLine)) ||
                    parsed.command || parsed.CommandLine || '';
    } catch {
      commandLine = input.trim();
    }

    if (!commandLine) {
      process.exit(0);
    }

    // Guard 1: Destructive recursive removal of root or .git
    if (/rm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+.*(\/|\.git)(\s|$)/i.test(commandLine)) {
      console.error('\x1b[31m[PROJECT-ANCHOR SAFETY GUARD] BLOCKED:\x1b[0m Destructive removal of repository or root files is prohibited.');
      process.exit(1);
    }

    // Guard 2: git reset --hard with dirty working tree
    if (/git\s+reset\s+--hard/i.test(commandLine)) {
      try {
        const status = execSync('git status --porcelain 2>/dev/null', { encoding: 'utf8' }).trim();
        if (status.length > 0) {
          console.error('\x1b[31m[PROJECT-ANCHOR SAFETY GUARD] BLOCKED:\x1b[0m git reset --hard requested with uncommitted changes.');
          console.error('  Please stash or commit changes first to prevent permanent data loss.');
          process.exit(1);
        }
      } catch {}
    }

    // Guard 3: Force push to protected branch (main/master)
    if (/git\s+push\s+.*(-f|--force).*(main|master)/i.test(commandLine)) {
      console.error('\x1b[31m[PROJECT-ANCHOR SAFETY GUARD] BLOCKED:\x1b[0m Force-pushing to protected branch (main/master) is prohibited.');
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    // If parse fails, do not block unless obviously dangerous
    process.exit(0);
  }
});
