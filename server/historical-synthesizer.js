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
  }

  scanProjectHistory(cwd = process.cwd()) {
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

    return {
      dossierPath,
      graveyardPath,
      commitsScanned: gitCommits.length,
      trapsCount: failureTraps.length,
      decisionsCount: architecturalDecisions.length
    };
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
