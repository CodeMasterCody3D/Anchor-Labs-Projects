#!/usr/bin/env node
const { execSync } = require('child_process');

class MemoryReconciler {
  constructor() {}

  reconcile({ rememberedAssumption = '', targetFile = '', symbolName = '', cwd = process.cwd() }) {
    let gitLog = '';
    let gitBlame = '';
    let currentCodeSnippet = '';

    if (targetFile) {
      try {
        gitLog = execSync(`git log -n 5 --oneline -- "${targetFile}" 2>/dev/null`, { cwd, encoding: 'utf8' }).trim();
      } catch {}

      if (symbolName) {
        try {
          currentCodeSnippet = execSync(`grep -n -C 4 "${symbolName}" "${targetFile}" 2>/dev/null`, { cwd, encoding: 'utf8' }).slice(0, 500);
        } catch {}
      }
    } else {
      try {
        gitLog = execSync('git log -n 5 --oneline 2>/dev/null', { cwd, encoding: 'utf8' }).trim();
      } catch {}
    }

    const report = `
[PROJECT-ANCHOR 3-WAY RECONCILIATION]
Does that sound familiar? Let's verify what you recalled against the codebase:

1. User Memory / Assumption:
   "${rememberedAssumption || 'N/A'}"

2. Current Codebase Implementation:
   ${targetFile ? `File: ${targetFile}${symbolName ? ` (Symbol: ${symbolName})` : ''}` : 'General Project State'}
   ${currentCodeSnippet ? `\`\`\`\n${currentCodeSnippet}\n\`\`\`` : 'Matches current repository structure.'}

3. Recent Evolution & Why It Changed (Git History):
   ${gitLog ? gitLog.split('\n').map(l => `• ${l}`).join('\n   ') : 'No commit history found for target.'}

Reconciliation Verdict:
• If the codebase drifted from what you remembered, the git history above shows the exact commit where it changed.
• Would you like to keep the current design or revert/refactor back to your remembered specification?
`.trim();

    return report;
  }
}

module.exports = MemoryReconciler;
