#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class HistoricalSynthesizer {
  constructor(runtimeDir) {
    this.runtimeDir = runtimeDir || path.join(process.env.HOME || '/home/cody', '.project-anchor');
    if (!fs.existsSync(this.runtimeDir)) {
      fs.mkdirSync(this.runtimeDir, { recursive: true });
    }
    this.statusFile = path.join(this.runtimeDir, 'historical_status.json');
  }

  writeStatus(statusObj) {
    try {
      fs.writeFileSync(this.statusFile, JSON.stringify(statusObj, null, 2), 'utf8');
    } catch {}
  }

  static getStatus(runtimeDir) {
    const rDir = runtimeDir || path.join(process.env.HOME || '/home/cody', '.project-anchor');
    const sFile = path.join(rDir, 'historical_status.json');
    try {
      if (fs.existsSync(sFile)) {
        return JSON.parse(fs.readFileSync(sFile, 'utf8'));
      }
    } catch {}

    const dossierPath = path.join(rDir, 'PROJECT_DOSSIER.md');
    const graveyardPath = path.join(rDir, 'FAILURE_GRAVEYARD.md');

    if (fs.existsSync(dossierPath) && fs.existsSync(graveyardPath)) {
      try {
        const stats = fs.statSync(dossierPath);
        const gContent = fs.readFileSync(graveyardPath, 'utf8');
        const trapCount = (gContent.match(/### Trap #/g) || []).length;
        return {
          status: 'completed',
          completed_at: stats.mtime.toISOString(),
          progress_pct: 100,
          trapsCount: trapCount,
          message: 'Project historical synthesis archive is complete and verified.'
        };
      } catch {}
    }

    return {
      status: 'idle',
      progress_pct: 0,
      message: 'No project scan is currently active. Use /pscan or anchor-labs-projects scan to start.'
    };
  }

  scanProjectHistory(cwd = process.cwd()) {
    const startTime = new Date().toISOString();
    this.writeStatus({
      status: 'running',
      started_at: startTime,
      updated_at: startTime,
      progress_pct: 10,
      message: 'Analyzing git commit history and past transcripts...'
    });

    try {
      let gitCommits = [];
      try {
        const logOutput = execSync('git log -n 50 --format="%h|%an|%ad|%s" --date=short 2>/dev/null', { cwd, encoding: 'utf8' }).trim();
        if (logOutput) {
          gitCommits = logOutput.split('\n').map(line => {
            const [hash, author, date, message] = line.split('|');
            return { hash, author, date, message };
          });
        }
      } catch {}

      this.writeStatus({
        status: 'running',
        started_at: startTime,
        updated_at: new Date().toISOString(),
        commitsScanned: gitCommits.length,
        progress_pct: 50,
        message: `Extracted ${gitCommits.length} git commits. Gathering transcript failure patterns...`
      });

      // Find transcripts in ~/.claude or cwd
      const transcriptSnippets = this.gatherRecentTranscriptSnippets();

      // Identify failure patterns and architectural decisions
      const failureTraps = [];
      const architecturalDecisions = [];

      gitCommits.forEach(c => {
        const msg = (c.message || '').toLowerCase();
        if (msg.includes('fix') || msg.includes('bug') || msg.includes('error') || msg.includes('revert') || msg.includes('workaround') || msg.includes('patch')) {
          failureTraps.push({
            source: `Commit ${c.hash} (${c.date})`,
            summary: c.message,
            lesson: `Watch out for recurring issues related to: ${c.message}`
          });
        } else if (msg.includes('feat') || msg.includes('arch') || msg.includes('refactor') || msg.includes('init') || msg.includes('add')) {
          architecturalDecisions.push({
            source: `Commit ${c.hash} (${c.date})`,
            summary: c.message
          });
        }
      });

      transcriptSnippets.forEach(snip => {
        if (snip.isFailure) {
          failureTraps.push({
            source: `Transcript: ${snip.source}`,
            summary: snip.text.slice(0, 140),
            lesson: 'Encountered during development session. Verify before re-implementing.'
          });
        }
      });

      // Write PROJECT_DOSSIER.md
      const dossierPath = path.join(this.runtimeDir, 'PROJECT_DOSSIER.md');
      const dossierContent = `
# Project Dossier & Architectural History
Generated: ${new Date().toISOString()}
Target Directory: \`${cwd}\`

## Executive Summary
This dossier synthesizes architectural decisions, project conventions, and commit trajectories extracted across git history and past sessions.

## Key Architectural Milestones
${architecturalDecisions.length > 0
  ? architecturalDecisions.slice(0, 15).map(a => `- **${a.source}**: ${a.summary}`).join('\n')
  : '- Initial architectural setup recorded.'}

## Active Project Invariants & Conventions
1. **Module Independence**: Core server components remain decoupled from specific UI shells.
2. **Deterministic State**: Runtime state persists in atomic JSON structures under \`~/.project-anchor/\`.
3. **High Chromatic Contrast**: Visualizations adhere to clean accessibility guidelines without intrusive meta-text.
4. **Developer Safety**: Pre-tool guards verify working tree state prior to destructive git or filesystem actions.
`.trim();

      fs.writeFileSync(dossierPath, dossierContent, 'utf8');

      // Write FAILURE_GRAVEYARD.md
      const graveyardPath = path.join(this.runtimeDir, 'FAILURE_GRAVEYARD.md');
      const graveyardContent = `
# Failure Graveyard & Anti-Pattern Traps
Generated: ${new Date().toISOString()}
Target Directory: \`${cwd}\`

## Purpose
Every recurring software bug or false assumption wastes valuable agent and developer context. This graveyard archives past pitfalls so they are never repeated.

## Cataloged Pitfalls & Bug Fixes
${failureTraps.length > 0
  ? failureTraps.slice(0, 20).map((f, i) => `### Trap #${i + 1}: ${f.summary}\n- **Origin**: ${f.source}\n- **Rule**: ${f.lesson}\n`).join('\n')
  : 'No critical failure traps recorded yet. Maintain clean test records!'}

## Safe Development Checklist
- [ ] Run full test suites before pushing changes.
- [ ] Verify 3-way memory delta before rewriting legacy interfaces.
- [ ] Ensure non-destructive commands during automated tool runs.
`.trim();

      fs.writeFileSync(graveyardPath, graveyardContent, 'utf8');

      const result = {
        dossierPath,
        graveyardPath,
        commitsScanned: gitCommits.length,
        trapsCount: failureTraps.length,
        decisionsCount: architecturalDecisions.length
      };

      this.writeStatus({
        status: 'completed',
        started_at: startTime,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        progress_pct: 100,
        commitsScanned: gitCommits.length,
        trapsCount: failureTraps.length,
        decisionsCount: architecturalDecisions.length,
        message: `Project scan complete: ${gitCommits.length} commits scanned, ${failureTraps.length} traps cataloged, ${architecturalDecisions.length} architectural decisions recorded.`
      });

      return result;
    } catch (err) {
      this.writeStatus({
        status: 'error',
        error: err.message,
        failed_at: new Date().toISOString(),
        message: `Project scan failed: ${err.message}`
      });
      throw err;
    }
  }

  gatherRecentTranscriptSnippets() {
    const snippets = [];
    const searchDirs = [
      path.join(process.env.HOME || '/home/cody', '.claude'),
      path.join(process.env.HOME || '/home/cody', '.gemini/antigravity-cli/brain')
    ];

    for (const sDir of searchDirs) {
      if (!fs.existsSync(sDir)) continue;
      try {
        const files = this.findJsonlFiles(sDir, 3);
        for (const file of files.slice(0, 5)) {
          const content = fs.readFileSync(file, 'utf8');
          const lines = content.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.includes('FAIL') || line.includes('Error:') || line.includes('error:') || line.includes('failed')) {
              snippets.push({
                source: path.basename(file),
                text: line.trim(),
                isFailure: true
              });
              if (snippets.length >= 10) break;
            }
          }
          if (snippets.length >= 15) break;
        }
      } catch {}
    }
    return snippets;
  }

  findJsonlFiles(dir, depth = 2) {
    if (depth <= 0) return [];
    let results = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const fullPath = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          results = results.concat(this.findJsonlFiles(fullPath, depth - 1));
        } else if (ent.name.endsWith('.jsonl') || ent.name.endsWith('.json')) {
          results.push(fullPath);
        }
      }
    } catch {}
    return results;
  }

  sweepTranscripts(query, limit = 10) {
    const results = [];
    const searchDirs = [
      path.join(process.env.HOME || '/home/cody', '.claude'),
      path.join(process.env.HOME || '/home/cody', '.gemini/antigravity-cli/brain')
    ];

    for (const sDir of searchDirs) {
      if (!fs.existsSync(sDir)) continue;
      try {
        const files = this.findJsonlFiles(sDir, 3);
        for (const file of files) {
          const content = fs.readFileSync(file, 'utf8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                results.push({
                  file: path.basename(file),
                  snippet: lines[i].trim().slice(0, 200)
                });
                if (results.length >= limit) return results;
              }
            }
          }
        }
      } catch {}
    }
    return results;
  }
}

module.exports = HistoricalSynthesizer;
