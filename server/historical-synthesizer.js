#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const MEMORY_DB = path.join(process.env.HOME || '/home/cody', '.claude-mem/claude-mem.db');

// Self-referential ingestion protection:
// Skipping files/commands that cat or display past synthesis reports to prevent feedback loops.
const SELF_ARTIFACT = /PROJECT_DOSSIER|FAILURE_GRAVEYARD|HISTORICAL_ARCHIVE|Project Dossier & Architectural History|Failure Graveyard & Anti-Pattern Traps|\.project-anchor\b/i;

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

  scanProjectHistory(cwd = process.cwd(), options = {}) {
    const startTime = new Date().toISOString();
    const skipMemory = !!options.skipMemory;

    this.writeStatus({
      status: 'running',
      started_at: startTime,
      updated_at: startTime,
      progress_pct: 5,
      message: 'Analyzing git commit trajectory...'
    });

    try {
      // 1. Gather git commits
      let gitCommits = [];
      try {
        const logOutput = execSync('git log -n 100 --format="%h|%an|%ad|%s" --date=short 2>/dev/null', { cwd, encoding: 'utf8' }).trim();
        if (logOutput) {
          gitCommits = logOutput.split('\n').map(line => {
            const [hash, author, date, message] = line.split('|');
            return { hash, author, date, message };
          });
        }
      } catch {}

      const summary = {
        cwd,
        commitsScanned: gitCommits.length,
        architecturalDecisions: [],
        failureTraps: new Map(), // deduplicated by signature
        measured_metrics: [],
        recalled_runs: [],
        mentioned_count: 0,
        self_referential_skips: 0
      };

      // Process git commit history
      gitCommits.forEach(c => {
        const msg = (c.message || '').trim();
        const lower = msg.toLowerCase();
        if (lower.includes('fix') || lower.includes('bug') || lower.includes('error') || lower.includes('revert') || lower.includes('workaround') || lower.includes('patch')) {
          const key = `commit:${msg.slice(0, 60)}`;
          if (!summary.failureTraps.has(key)) {
            summary.failureTraps.set(key, {
              title: msg,
              source: `Commit ${c.hash} (${c.date})`,
              lesson: `Watch out for recurring regression: ${msg}`,
              provenance: 'measured'
            });
          }
        } else if (lower.includes('feat') || lower.includes('arch') || lower.includes('refactor') || lower.includes('init') || lower.includes('add')) {
          summary.architecturalDecisions.push({
            source: `Commit ${c.hash} (${c.date})`,
            summary: msg,
            provenance: 'measured'
          });
        }
      });

      this.writeStatus({
        status: 'running',
        started_at: startTime,
        updated_at: new Date().toISOString(),
        progress_pct: 30,
        commitsScanned: gitCommits.length,
        message: `Extracted ${gitCommits.length} commits. Scanning session transcripts...`
      });

      // 2. Scan raw session transcripts (with bug fixes applied)
      this.scanTranscriptFiles(summary);

      // 3. Scan claude-mem database if available and not skipped
      if (!skipMemory) {
        this.writeStatus({
          status: 'running',
          started_at: startTime,
          updated_at: new Date().toISOString(),
          progress_pct: 70,
          commitsScanned: gitCommits.length,
          message: 'Reading claude-mem SQLite database for pre-retention history...'
        });
        this.scanClaudeMemDatabase(summary);
      }

      this.writeStatus({
        status: 'running',
        started_at: startTime,
        updated_at: new Date().toISOString(),
        progress_pct: 90,
        commitsScanned: gitCommits.length,
        message: 'Synthesizing PROJECT_DOSSIER.md, FAILURE_GRAVEYARD.md & HISTORICAL_ARCHIVE.json...'
      });

      // 4. Save artifacts
      const result = this.saveHistoricalRecords(summary);

      this.writeStatus({
        status: 'completed',
        started_at: startTime,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        progress_pct: 100,
        commitsScanned: gitCommits.length,
        trapsCount: summary.failureTraps.size,
        decisionsCount: summary.architecturalDecisions.length,
        recalled_count: summary.recalled_runs.length,
        message: `Project scan complete: ${gitCommits.length} commits scanned, ${summary.failureTraps.size} traps documented, ${summary.architecturalDecisions.length} architectural decisions, ${summary.recalled_runs.length} recalled entries archived.`
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

  // Scan raw session transcripts
  scanTranscriptFiles(summary) {
    const searchDirs = [
      path.join(process.env.HOME || '/home/cody', '.claude'),
      path.join(process.env.HOME || '/home/cody', '.gemini/antigravity-cli/brain')
    ];

    for (const sDir of searchDirs) {
      if (!fs.existsSync(sDir)) continue;
      try {
        const files = this.findJsonlFiles(sDir, 3);
        for (const file of files.slice(0, 15)) {
          try {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
              if (!line.trim()) continue;

              // Self-artifact ingestion check
              if (SELF_ARTIFACT.test(line)) {
                summary.self_referential_skips++;
                continue;
              }

              // Parse line to extract genuine command output
              let commandOutput = '';
              try {
                const parsed = JSON.parse(line);
                // Restrict to genuine Bash/tool output to prevent document reading laundering
                if (parsed.tool_name === 'Bash' || parsed.tool_name === 'run_command' || parsed.toolUseResult) {
                  const res = parsed.tool_response || parsed.toolUseResult;
                  if (typeof res === 'string') commandOutput = res;
                  else if (res && typeof res === 'object') {
                    if (res.stdout) commandOutput += ' ' + res.stdout;
                    if (res.stderr) commandOutput += ' ' + res.stderr;
                    if (res.output) commandOutput += ' ' + res.output;
                  }
                }
              } catch {
                commandOutput = line;
              }

              if (!commandOutput) continue;

              // Check for failure traps with escaped newline awareness
              this.detectGeneralFailures(commandOutput, path.basename(file), summary, 'measured');
            }
          } catch {}
        }
      } catch {}
    }
  }

  // Read claude-mem SQLite database for pre-retention history
  scanClaudeMemDatabase(summary, dbPath = MEMORY_DB) {
    const coverage = {
      available: false,
      earliest: null,
      latest: null,
      rows_read: 0,
      recalled_entries: 0
    };

    if (!fs.existsSync(dbPath)) {
      coverage.error = `Database not found at ${dbPath}`;
      summary.memory_coverage = coverage;
      return coverage;
    }

    let DatabaseSync;
    const emitWarning = process.emitWarning;
    try {
      process.emitWarning = () => {};
      DatabaseSync = require('node:sqlite').DatabaseSync;
    } catch (e) {
      process.emitWarning = emitWarning;
      coverage.error = `node:sqlite unavailable (${e.message})`;
      summary.memory_coverage = coverage;
      return coverage;
    }

    let db;
    try {
      db = new DatabaseSync(dbPath, { readOnly: true });
    } catch (e) {
      process.emitWarning = emitWarning;
      coverage.error = `Could not open claude-mem db read-only: ${e.message}`;
      summary.memory_coverage = coverage;
      return coverage;
    }

    let rows = 0;
    try {
      // 1. Tool uses (only Bash/BashOutput tool invocations)
      try {
        const sql = 'SELECT memory_session_id AS sid, project, created_at, tool_name, tool_input, tool_response'
          + " FROM tool_uses WHERE tool_response IS NOT NULL AND tool_name IN ('Bash','BashOutput','run_command')";
        for (const r of db.prepare(sql).all()) {
          rows++;
          if (SELF_ARTIFACT.test(String(r.tool_input || ''))) {
            summary.self_referential_skips++;
            continue;
          }
          let text = '';
          try {
            const parsed = JSON.parse(r.tool_response);
            if (typeof parsed === 'string') text = parsed;
            else if (parsed && typeof parsed === 'object') {
              if (parsed.stdout) text += ' ' + parsed.stdout;
              if (parsed.stderr) text += ' ' + parsed.stderr;
            }
          } catch {
            text = String(r.tool_response || '');
          }
          if (!text.trim() || SELF_ARTIFACT.test(text)) continue;

          this.detectGeneralFailures(text, r.sid || 'claude-mem', summary, 'measured');
        }
      } catch (e) {
        coverage.tool_uses_error = e.message;
      }

      // 2. Distilled prose -> 'recalled'
      const proseQueries = [
        ['observations',
          "SELECT memory_session_id AS sid, project, created_at, "
          + "COALESCE(title,'') || ' ' || COALESCE(text,'') || ' ' || "
          + "COALESCE(narrative,'') || ' ' || COALESCE(facts,'') AS blob FROM observations"],
        ['session_summaries',
          "SELECT memory_session_id AS sid, project, created_at, "
          + "COALESCE(request,'') || ' ' || COALESCE(investigated,'') || ' ' || "
          + "COALESCE(learned,'') || ' ' || COALESCE(completed,'') || ' ' || "
          + "COALESCE(notes,'') AS blob FROM session_summaries"]
      ];

      for (const [tbl, sql] of proseQueries) {
        try {
          for (const r of db.prepare(sql).all()) {
            rows++;
            const text = String(r.blob || '');
            if (!text.trim() || SELF_ARTIFACT.test(text)) continue;

            const meta = { source: `claude-mem:${tbl}`, date: r.created_at, mem_project: r.project };
            
            // Check for recalled failure traps
            this.detectGeneralFailures(text, r.sid || 'claude-mem', summary, 'recalled', meta);

            // Check for recalled architectural decisions
            this.detectRecalledDecisions(text, r.sid || 'claude-mem', summary, meta);

            // Record as recalled entry
            summary.recalled_runs.push({
              source: `claude-mem:${tbl}`,
              date: r.created_at,
              project: r.project || 'software-dev',
              snippet: text.slice(0, 160)
            });
          }
        } catch (e) {
          coverage[`${tbl}_error`] = e.message;
        }
      }

      try {
        const d = db.prepare('SELECT MIN(substr(created_at,1,10)) a, MAX(substr(created_at,1,10)) b FROM observations').get();
        if (d) { coverage.earliest = d.a; coverage.latest = d.b; }
      } catch {}

      coverage.available = true;
      coverage.rows_read = rows;
      coverage.recalled_entries = summary.recalled_runs.length;
    } finally {
      try { db.close(); } catch {}
      process.emitWarning = emitWarning;
    }

    summary.memory_coverage = coverage;
    return coverage;
  }

  detectGeneralFailures(text, sourceId, summary, provenance = 'measured', meta = {}) {
    // Normalise escaped newlines (\n) to actual spaces/newlines so \b word boundary works
    const normalized = text.replace(/\\n/g, '\n').replace(/\\t/g, ' ');

    const commonErrorPatterns = [
      { name: 'Node Module Resolution Failure', regex: /\b(?:Cannot find module|MODULE_NOT_FOUND)\b/i, rule: 'Ensure npm dependencies are locked and peer dependencies resolved.' },
      { name: 'Git Detached Head / Dirty Tree Conflict', regex: /\b(?:fatal: Not a valid object name|error: Your local changes to the following files would be overwritten)\b/i, rule: 'Stash or commit changes before checking out or merging branches.' },
      { name: 'Port / Address In Use (EADDRINUSE)', regex: /\b(?:EADDRINUSE|address already in use)\b/i, rule: 'Kill dangling background processes or configure dynamic port allocation.' },
      { name: 'Command Not Found / Toolchain Missing', regex: /\b(?:command not found|is not recognized as an internal or external command)\b/i, rule: 'Run anchor-labs-projects doctor to verify toolchain PATH.' },
      { name: 'Permission Denied (EACCES)', regex: /\b(?:EACCES|permission denied)\b/i, rule: 'Ensure correct executable chmod +x permissions and non-root file ownership.' },
      { name: 'Syntax / Parse Error', regex: /\b(?:SyntaxError|JSON\.parse|Unexpected token)\b/i, rule: 'Verify JSON / code syntax with linters before committing.' },
      { name: 'Test Assertion Failure', regex: /\b(?:FAIL|AssertionError|expected .* to equal .*)\b/i, rule: 'Run targeted test suites before submitting pull requests.' }
    ];

    for (const pat of commonErrorPatterns) {
      if (pat.regex.test(normalized)) {
        const key = `${pat.name}`;
        if (!summary.failureTraps.has(key)) {
          const matchIdx = normalized.search(pat.regex);
          const snippet = normalized.slice(Math.max(0, matchIdx - 40), matchIdx + 200).replace(/\s+/g, ' ').trim();
          summary.failureTraps.set(key, {
            title: pat.name,
            source: meta.source ? `${meta.source} (${String(meta.date || '').slice(0, 10)})` : `Session: ${sourceId}`,
            lesson: pat.rule,
            snippet,
            provenance
          });
        }
      }
    }
  }

  detectRecalledDecisions(text, sourceId, summary, meta = {}) {
    const decisionMarkers = /\b(?:decided to|agreed on|chosen architecture|adopted|switched to|standardized on)\b/i;
    if (decisionMarkers.test(text)) {
      const matchIdx = text.search(decisionMarkers);
      const snippet = text.slice(matchIdx, matchIdx + 140).replace(/\s+/g, ' ').trim();
      summary.architecturalDecisions.push({
        source: `claude-mem (${String(meta.date || '').slice(0, 10)})`,
        summary: snippet,
        provenance: 'recalled'
      });
    }
  }

  saveHistoricalRecords(summary) {
    // 1. Write PROJECT_DOSSIER.md
    const dossierPath = path.join(this.runtimeDir, 'PROJECT_DOSSIER.md');
    const cov = summary.memory_coverage || {};

    let dossierContent = `# Project Dossier & Architectural History\n\n`;
    dossierContent += `> Generated: ${new Date().toISOString()}\n`;
    dossierContent += `> Target Directory: \`${summary.cwd}\`\n\n`;

    dossierContent += `## 1. Executive Summary\n`;
    dossierContent += `This dossier synthesizes architectural decisions, verified git commits, and distilled memories across project history.\n\n`;

    dossierContent += `## 2. Key Architectural Milestones & Decisions\n`;
    if (summary.architecturalDecisions.length > 0) {
      summary.architecturalDecisions.slice(0, 20).forEach(a => {
        dossierContent += `- **${a.source}** [${a.provenance}]: ${a.summary}\n`;
      });
    } else {
      dossierContent += `- Initial project architecture and dependencies established.\n`;
    }

    dossierContent += `\n## 3. Pre-Retention Archive (Recalled from claude-mem)\n`;
    if (!cov.available) {
      dossierContent += `> claude-mem database was not read${cov.error ? ` (${cov.error})` : ''}.\n\n`;
    } else {
      dossierContent += `Claude Code prunes raw transcripts on a rolling window. `;
      dossierContent += `claude-mem retains distilled records from **${cov.earliest || '?'}** to **${cov.latest || '?'}**, `;
      dossierContent += `allowing historical knowledge to survive across long-term development.\n\n`;
      dossierContent += `- Rows read from claude-mem: **${cov.rows_read || 0}**\n`;
      dossierContent += `- Recalled historical snippets: **${summary.recalled_runs.length}**\n\n`;
    }

    dossierContent += `## 4. Active Project Invariants & Conventions\n`;
    dossierContent += `1. **Deterministic State**: Runtime state persists in atomic JSON structures under \`~/.project-anchor/\`.\n`;
    dossierContent += `2. **High Chromatic Contrast**: Visualizations adhere to dark theme accessibility guidelines.\n`;
    dossierContent += `3. **Developer Safety**: Pre-tool guards verify working tree state prior to destructive git or filesystem actions.\n`;
    dossierContent += `4. **Three-Tier Provenance**: Clear separation between measured shell executions, recalled memory distillations, and raw prose.\n`;

    fs.writeFileSync(dossierPath, dossierContent.trim(), 'utf8');

    // 2. Write FAILURE_GRAVEYARD.md
    const graveyardPath = path.join(this.runtimeDir, 'FAILURE_GRAVEYARD.md');
    let graveyardContent = `# Failure Graveyard & Anti-Pattern Traps\n\n`;
    graveyardContent += `*Cataloged pitfalls, regressions, and lessons learned across past sessions and git commits.*\n\n`;

    if (summary.failureTraps.size > 0) {
      let trapIdx = 1;
      for (const [_, f] of summary.failureTraps) {
        graveyardContent += `### Trap #${trapIdx++}: ${f.title}\n`;
        graveyardContent += `- **Origin**: ${f.source} [${f.provenance}]\n`;
        graveyardContent += `- **Rule**: ${f.lesson}\n`;
        if (f.snippet) {
          graveyardContent += `\`\`\`text\n${f.snippet.slice(0, 240)}\n\`\`\`\n\n`;
        }
      }
    } else {
      graveyardContent += `No critical failure traps recorded yet. Maintain clean test records!\n`;
    }

    graveyardContent += `## Safe Development Checklist\n`;
    graveyardContent += `- [ ] Run full test suites before pushing changes.\n`;
    graveyardContent += `- [ ] Verify 3-way memory delta before rewriting legacy interfaces.\n`;
    graveyardContent += `- [ ] Ensure non-destructive commands during automated tool runs.\n`;

    fs.writeFileSync(graveyardPath, graveyardContent.trim(), 'utf8');

    // 3. Write HISTORICAL_ARCHIVE.json (recalled history)
    const archivePath = path.join(this.runtimeDir, 'HISTORICAL_ARCHIVE.json');
    const archiveContent = {
      generated_at: new Date().toISOString(),
      coverage: cov,
      total_recalled_entries: summary.recalled_runs.length,
      entries: summary.recalled_runs.slice(0, 100)
    };
    fs.writeFileSync(archivePath, JSON.stringify(archiveContent, null, 2), 'utf8');

    return {
      dossierPath,
      graveyardPath,
      archivePath,
      commitsScanned: summary.commitsScanned,
      trapsCount: summary.failureTraps.size,
      decisionsCount: summary.architecturalDecisions.length,
      recalledCount: summary.recalled_runs.length,
      coverage: cov
    };
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

if (require.main === module) {
  const synth = new HistoricalSynthesizer();
  const argv = process.argv.slice(2);
  const skipMemory = argv.includes('--no-memory');
  console.log('[HISTORICAL SYNTHESIZER]: Scanning project history, commits, transcripts and claude-mem...');
  const res = synth.scanProjectHistory(process.cwd(), { skipMemory });
  console.log(`\n✔ Project Historical Synthesis Complete!`);
  console.log(`• Commits Scanned: ${res.commitsScanned}`);
  console.log(`• Failure Traps Documented: ${res.trapsCount}`);
  console.log(`• Architectural Milestones: ${res.decisionsCount}`);
  if (res.coverage && res.coverage.available) {
    console.log(`• claude-mem archive: ${res.coverage.rows_read} rows read (coverage ${res.coverage.earliest} -> ${res.coverage.latest})`);
    console.log(`• Recalled History Entries: ${res.recalledCount} archived in HISTORICAL_ARCHIVE.json`);
  }
  console.log(`• Dossier: ${res.dossierPath}`);
  console.log(`• Graveyard: ${res.graveyardPath}`);
}

module.exports = HistoricalSynthesizer;
