#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ProjectManager = require('./project-manager');
const HistoricalSynthesizer = require('./historical-synthesizer');

const TMUX_SESSION = 'project-anchor-worker';

class AnchorChecker {
  constructor(runtimeDir) {
    this.runtimeDir = runtimeDir || path.join(process.env.HOME || '/home/cody', '.project-anchor');
    this.pm = new ProjectManager(this.runtimeDir);
  }

  getCheckStatus(cwd = process.cwd()) {
    // 1. Historical Synthesis Status
    const historical = HistoricalSynthesizer.getStatus(this.runtimeDir);

    // 2. Background tmux Worker Daemon
    let workerActive = false;
    let workerDetails = 'Inactive';
    try {
      execSync(`tmux has-session -t ${TMUX_SESSION} 2>/dev/null`);
      workerActive = true;
      const out = execSync(`tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created_string}" 2>/dev/null`, { encoding: 'utf8' }).trim();
      const match = out.split('\n').find(l => l.startsWith(TMUX_SESSION));
      workerDetails = match ? `Active (${match.split('|')[1]} windows, created ${match.split('|')[2]})` : 'Active';
    } catch {}

    // 3. Git & Project State
    const git = this.pm.getGitInfo(cwd);
    const conf = this.pm.getConfig();
    const tasks = this.pm.getTasks();
    const tests = this.pm.getTestHistory();
    const latestTest = tests[tests.length - 1] || null;

    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const todo = tasks.filter(t => t.status === 'todo');
    const completed = tasks.filter(t => t.status === 'completed');

    // 4. Supervisor Governance Invariants
    const governance = {
      role: 'CENTRAL_PROJECT_SUPERVISOR_AND_CONTROLLER',
      anti_drift_guard: 'ACTIVE (Main anchor maintains state ledger and controls subagents; never wanders into web searches or out-of-scope rabbit holes)',
      active_focus: conf.active_focus,
      active_milestone: conf.active_milestone,
      git_branch: git.branch,
      git_clean: git.isClean,
      modified_count: git.modifiedCount,
      last_commit: git.lastCommit
    };

    return {
      timestamp: new Date().toISOString(),
      governance,
      historical,
      subagents: {
        worker_daemon: {
          active: workerActive,
          session: TMUX_SESSION,
          details: workerDetails
        },
        in_flight_tasks: inProgress,
        todo_tasks: todo,
        completed_tasks_count: completed.length,
        latest_test: latestTest
      }
    };
  }

  renderReport(cwd = process.cwd()) {
    const status = this.getCheckStatus(cwd);
    const gov = status.governance;
    const h = status.historical;
    const sub = status.subagents;

    let out = `\n\x1b[1m\x1b[36m=====================================================\x1b[0m\n`;
    out += `\x1b[1m\x1b[36m  ANCHOR-LABS-PROJECTS SUPERVISOR & SUBAGENT AUDIT\x1b[0m\n`;
    out += `\x1b[1m\x1b[36m=====================================================\x1b[0m\n`;

    // 1. Main Project Anchor Supervisor
    out += `\x1b[1mMAIN ANCHOR SUPERVISOR:\x1b[0m\n`;
    out += `  • \x1b[1mRole:\x1b[0m            ${gov.role}\n`;
    out += `  • \x1b[1mAnti-Drift Guard:\x1b[0m \x1b[32m✔ ACTIVE\x1b[0m (Strictly controller mode; no stray web searches)\n`;
    out += `  • \x1b[1mActive Focus:\x1b[0m    "${gov.active_focus}" [${gov.active_milestone}]\n`;
    out += `  • \x1b[1mGit State:\x1b[0m       [${gov.git_branch}] ${gov.git_clean ? '\x1b[32mClean working tree\x1b[0m' : `\x1b[33m${gov.modified_count} modified files\x1b[0m`}\n`;
    out += `  • \x1b[1mLast Commit:\x1b[0m     ${gov.last_commit}\n\n`;

    // 2. Historical Project Synthesizer State
    out += `\x1b[1mHISTORICAL SYNTHESIZER STATUS:\x1b[0m\n`;
    if (h.status === 'running') {
      out += `  • \x1b[33m● RUNNING\x1b[0m (${h.progress_pct || 0}% complete)\n`;
      out += `  • \x1b[1mStatus Msg:\x1b[0m      ${h.message}\n\n`;
    } else if (h.status === 'completed') {
      out += `  • \x1b[32m✔ COMPLETED\x1b[0m (${h.progress_pct || 100}%)\n`;
      out += `  • \x1b[1mFinished At:\x1b[0m     ${h.completed_at || 'Recorded'}\n`;
      out += `  • \x1b[1mTraps Cataloged:\x1b[0m ${h.trapsCount || 0} failure traps in FAILURE_GRAVEYARD.md\n`;
      out += `  • \x1b[1mStatus Msg:\x1b[0m      ${h.message}\n\n`;
    } else if (h.status === 'error') {
      out += `  • \x1b[31m✖ ERROR\x1b[0m: ${h.message}\n\n`;
    } else {
      out += `  • \x1b[90m○ IDLE\x1b[0m: No project scan in progress. (Run '/pscan' or 'anchor-labs-projects scan')\n\n`;
    }

    // 3. Subagents & Background Workers
    out += `\x1b[1mSPAWNED SUBAGENTS & WORKER FLEET:\x1b[0m\n`;
    out += `  • \x1b[1mWorker Daemon:\x1b[0m   ${sub.worker_daemon.active ? '\x1b[32m● Running\x1b[0m (tmux: ' + sub.worker_daemon.session + ')' : '\x1b[90m○ Inactive\x1b[0m'}\n`;

    if (sub.in_flight_tasks.length > 0) {
      out += `  • \x1b[1mIn-Flight Tasks:\x1b[0m ${sub.in_flight_tasks.length} active\n`;
      sub.in_flight_tasks.forEach(t => {
        out += `      ▶ [${t.id}] ${t.title} (\x1b[1m${t.priority}\x1b[0m)\n`;
      });
    } else {
      out += `  • \x1b[1mIn-Flight Tasks:\x1b[0m 0 active tasks in progress\n`;
    }

    if (sub.todo_tasks.length > 0) {
      out += `  • \x1b[1mNext Backlog:\x1b[0m    [${sub.todo_tasks[0].id}] ${sub.todo_tasks[0].title}\n`;
    }

    if (sub.latest_test) {
      out += `  • \x1b[1mTest Health:\x1b[0m     ${sub.latest_test.suite} - \x1b[32m${sub.latest_test.passed} passed\x1b[0m, \x1b[31m${sub.latest_test.failed} failed\x1b[0m (${sub.latest_test.coverage_pct}% cov)\n`;
    }

    out += `\x1b[1m\x1b[36m=====================================================\x1b[0m\n`;
    return out;
  }
}

if (require.main === module) {
  const checker = new AnchorChecker();
  console.log(checker.renderReport());
}

module.exports = AnchorChecker;
