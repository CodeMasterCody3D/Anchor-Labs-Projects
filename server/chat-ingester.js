#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const SessionRouter = require('./session-router');

class ChatIngester {
  constructor(runtimeDir = null) {
    this.runtimeDir = runtimeDir || path.join(process.env.HOME || '/home/cody', '.project-anchor');
    if (!fs.existsSync(this.runtimeDir)) {
      fs.mkdirSync(this.runtimeDir, { recursive: true });
    }
    this.router = new SessionRouter(this.runtimeDir);
  }

  getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  }

  readTodayTurns(transcriptPath, targetDateStr = null) {
    const todayStr = targetDateStr || this.getTodayDateString();
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      return [];
    }

    try {
      const stats = fs.statSync(transcriptPath);
      const fileSize = stats.size;
      const chunkSize = Math.min(fileSize, 40 * 1024 * 1024);

      const fd = fs.openSync(transcriptPath, 'r');
      const buffer = Buffer.alloc(chunkSize);
      fs.readSync(fd, buffer, 0, chunkSize, fileSize - chunkSize);
      fs.closeSync(fd);

      const content = buffer.toString('utf8');
      const rawLines = content.split('\n');
      const lines = (chunkSize < fileSize) ? rawLines.slice(1) : rawLines;

      const turns = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line);
          const ts = item.timestamp || '';
          if (ts.startsWith(todayStr)) {
            turns.push(item);
          }
        } catch {}
      }

      return turns;
    } catch {
      return [];
    }
  }

  ingestSession(cwd = null, sessionId = null, targetDateStr = null) {
    const baseDir = cwd || process.cwd();
    const sessionInfo = this.router.findTranscriptForSession(baseDir, sessionId) || this.router.getActiveSession(baseDir);
    const targetDate = targetDateStr || this.getTodayDateString();
    const projName = path.basename(sessionInfo.project_dir || baseDir);

    const turns = this.readTodayTurns(sessionInfo.transcript_path, targetDate);
    const findings = [];
    const activePlans = [];
    const userDirectives = [];
    const filesReferenced = new Set();
    const commandsReferenced = new Set();

    for (const turn of turns) {
      const turnType = turn.type;
      const ts = turn.timestamp || '';

      if (turnType === 'user') {
        let text = '';
        const c = turn.message ? turn.message.content : turn.content;
        if (typeof c === 'string') text = c;
        else if (Array.isArray(c)) {
          text = c.map(item => item.text || '').join(' ');
        }

        if (text && text.length > 5) {
          if (/(can we|test|fix|build|run|check|try|implement|convert|does|why)/i.test(text)) {
            userDirectives.push({ timestamp: ts, text: text.trim() });
          }
        }
      } else if (turnType === 'assistant') {
        let text = '';
        const c = turn.message ? turn.message.content : turn.content;
        if (typeof c === 'string') text = c;
        else if (Array.isArray(c)) {
          text = c.map(item => item.text || '').join(' ');
        }

        if (!text) continue;

        // Extract referenced files (.js, .ts, .cpp, .h, .py, .cs, .dts, .dif, etc.)
        const fileMatches = text.match(/[\w-]+\.(js|ts|cpp|hpp|c|h|py|cs|dts|dif|json|yml|md)\b/gi);
        if (fileMatches) {
          fileMatches.forEach(f => filesReferenced.add(f));
        }

        // Extract CLI commands (e.g. npm, cargo, pytest, torch, make)
        const cmdMatches = text.match(/\b(npm|cargo|pytest|make|torch|cmake|gcc|clang)\s+[a-zA-Z0-9_\-\.\/]+/gi);
        if (cmdMatches) {
          cmdMatches.forEach(cmd => commandsReferenced.add(cmd.trim()));
        }

        // Detect verified findings, bug fixes, and passing tests
        if (/(# ✅|✔|PASSED|passed|fixed|working|verified|confirmed|test passed|all tests passed)/i.test(text)) {
          const paragraphs = text.split(/\n\s*\n/);
          for (const para of paragraphs) {
            if (/(fixed|passed|verified|works|working|confirmed|test result|regression)/i.test(para)) {
              const clean = para.trim();
              if (clean.length > 30 && !findings.some(f => f.text === clean)) {
                const firstLine = clean.split('\n')[0].replace(/^[#\s*`✔✅\-]+/, '').trim();
                findings.push({
                  timestamp: ts,
                  title: firstLine || 'Software Engineering Finding',
                  text: clean,
                  verified: true
                });
              }
            }
          }
        }

        // Detect active plans & next development steps
        if (/(next step|plan now|now to|next up|next:|backlog|we will now)/i.test(text)) {
          const paragraphs = text.split(/\n\s*\n/);
          for (const para of paragraphs) {
            if (/(next step|plan now|next up|next:|we will now)/i.test(para)) {
              const clean = para.trim();
              if (clean.length > 30 && !activePlans.some(p => p.text === clean)) {
                activePlans.push({
                  timestamp: ts,
                  text: clean
                });
              }
            }
          }
        }
      }
    }

    const latestPlan = activePlans[activePlans.length - 1] ? activePlans[activePlans.length - 1].text : 'Feature development and minimal test verification';
    const latestFinding = findings[findings.length - 1] ? findings[findings.length - 1].text : 'Initial architecture verified';
    const filesList = Array.from(filesReferenced).slice(0, 15);
    const cmdsList = Array.from(commandsReferenced).slice(0, 10);

    // 1. Write CONFIRMED_FINDINGS.md
    const findingsFile = path.join(this.runtimeDir, 'CONFIRMED_FINDINGS.md');
    let findingsMd = `# 📜 Confirmed Project Findings & Validated Tests\n\n`;
    findingsMd += `> Project: \`${projName}\` | Target Date: ${targetDate}\n`;
    findingsMd += `> Verified Consensus: **Developer (Intent) ⇄ Claude (Implementation) ⇄ Project Anchor (Ledger)**\n\n`;

    if (findings.length > 0) {
      findings.forEach((f, idx) => {
        findingsMd += `### Finding #${idx + 1}: ${f.title}\n`;
        findingsMd += `*Logged At: ${f.timestamp}*\n\n`;
        findingsMd += `${f.text}\n\n`;
        findingsMd += `---\n\n`;
      });
    } else {
      findingsMd += `*No finalized verdicts logged yet for ${targetDate}. Active work ongoing.*\n\n`;
    }

    findingsMd += `### 🛠️ Associated Files & Commands Today:\n`;
    findingsMd += `- **Files**: ${filesList.length ? filesList.map(s => `\`${s}\``).join(', ') : 'None'}\n`;
    findingsMd += `- **Commands**: ${cmdsList.length ? cmdsList.map(r => `\`${r}\``).join(', ') : 'None'}\n`;

    fs.writeFileSync(findingsFile, findingsMd, 'utf8');

    // 2. Write ACTIVE_PLAN.md
    const planFile = path.join(this.runtimeDir, 'ACTIVE_PLAN.md');
    let planMd = `# 🧭 Active Plan & Development Direction\n\n`;
    planMd += `> Last Updated: ${new Date().toISOString()} | Session: \`${sessionInfo.session_id || 'active'}\`\n\n`;
    planMd += `## 🎯 Current Operational Focus\n\n`;
    planMd += `${latestPlan}\n\n`;

    planMd += `## 💡 Pipeline Minimality Invariant (Anti-Confusion Guard)\n`;
    planMd += `- **Targeted Test Rule**: When testing a single function, bug fix, or asset converter, run **ONLY** the minimal test command or script.\n`;
    planMd += `- **No Accidental Pipeline Escalation**: Do NOT trigger full release builds, entire package re-indexing, or multi-crate rebuilds for an isolated check.\n`;
    planMd += `- **Minimal Reproduction**: If a test or build command fails, reproduce on the minimal failing module before attempting wider refactors.\n\n`;

    if (userDirectives.length > 0) {
      planMd += `## 🗣️ Recent Developer Directives:\n`;
      userDirectives.slice(-5).forEach(d => {
        planMd += `- *[${d.timestamp.split('T')[1].slice(0, 5)}]* ${d.text}\n`;
      });
      planMd += '\n';
    }

    fs.writeFileSync(planFile, planMd, 'utf8');

    // 3. Write FINDINGS_LEDGER.json
    const ledgerFile = path.join(this.runtimeDir, 'FINDINGS_LEDGER.json');
    const ledgerPayload = {
      project: projName,
      session_id: sessionInfo.session_id,
      date: targetDate,
      last_updated: new Date().toISOString(),
      findings_count: findings.length,
      findings,
      latest_plan: latestPlan,
      files_referenced: filesList,
      commands_referenced: cmdsList,
      user_directives_count: userDirectives.length
    };
    fs.writeFileSync(ledgerFile, JSON.stringify(ledgerPayload, null, 2), 'utf8');

    // 4. Write live_tips.json
    const tipsFile = path.join(this.runtimeDir, 'live_tips.json');
    const liveTips = {
      project: projName,
      session_id: sessionInfo.session_id,
      latest_finding_headline: findings[findings.length - 1] ? findings[findings.length - 1].title : 'Code verification active',
      current_plan_headline: latestPlan.split('\n')[0].replace(/^[#\s*`\-]+/, '').slice(0, 160),
      active_files: filesList.slice(0, 5),
      scope_tip: 'Scope Check: If testing a single fix or command, run the minimal targeted test. Do not run full project rebuilds unless requested.'
    };
    fs.writeFileSync(tipsFile, JSON.stringify(liveTips, null, 2), 'utf8');

    return {
      success: true,
      project: projName,
      session_id: sessionInfo.session_id,
      turns_scanned: turns.length,
      findings_count: findings.length,
      latest_finding: findings[findings.length - 1] || null,
      latest_plan: latestPlan,
      findingsFile,
      planFile,
      ledgerFile
    };
  }
}

if (require.main === module) {
  const ingester = new ChatIngester();
  const res = ingester.ingestSession();
  console.log(`\n✔ Ingestion Complete for project: ${res.project} (Session: ${res.session_id})`);
  console.log(`• Turns Scanned: ${res.turns_scanned}`);
  console.log(`• Confirmed Findings: ${res.findings_count}`);
  console.log(`• Findings Doc: ${res.findingsFile}`);
  console.log(`• Active Plan Doc: ${res.planFile}\n`);
}

module.exports = ChatIngester;
