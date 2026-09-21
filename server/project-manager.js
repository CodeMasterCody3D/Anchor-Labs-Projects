#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RUNTIME_DIR = path.join(process.env.HOME || '/home/cody', '.project-anchor');
const CONFIG_PATH = path.join(RUNTIME_DIR, 'config.json');
const TASKS_PATH = path.join(RUNTIME_DIR, 'tasks.json');
const TESTS_PATH = path.join(RUNTIME_DIR, 'test_history.json');

class ProjectManager {
  constructor(runtimeDir = RUNTIME_DIR) {
    this.runtimeDir = runtimeDir;
    if (!fs.existsSync(this.runtimeDir)) {
      fs.mkdirSync(this.runtimeDir, { recursive: true });
    }
    this.ensureFiles();
  }

  ensureFiles() {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({
        active_focus: 'General Development',
        active_milestone: 'v1.0 Milestone',
        harvester_model: 'openai/gpt-5.6-luna'
      }, null, 2), 'utf8');
    }

    if (!fs.existsSync(TASKS_PATH)) {
      const initialTasks = [
        { id: 'T-1', title: 'Initialize project architecture and dependencies', status: 'completed', priority: 'high', created_at: new Date().toISOString() },
        { id: 'T-2', title: 'Implement core modules and unit test coverage', status: 'in_progress', priority: 'high', created_at: new Date().toISOString() },
        { id: 'T-3', title: 'Configure CI/CD and release pipeline', status: 'todo', priority: 'medium', created_at: new Date().toISOString() }
      ];
      fs.writeFileSync(TASKS_PATH, JSON.stringify(initialTasks, null, 2), 'utf8');
    }

    if (!fs.existsSync(TESTS_PATH)) {
      const initialTests = [
        { timestamp: new Date().toISOString(), suite: 'Unit Tests', passed: 18, failed: 0, skipped: 1, duration_ms: 340, coverage_pct: 88.5 }
      ];
      fs.writeFileSync(TESTS_PATH, JSON.stringify(initialTests, null, 2), 'utf8');
    }
  }

  getConfig() {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
      return { active_focus: 'General Development', active_milestone: 'v1.0 Milestone' };
    }
  }

  setFocus(focus, milestone = '') {
    const conf = this.getConfig();
    if (focus) conf.active_focus = focus;
    if (milestone) conf.active_milestone = milestone;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(conf, null, 2), 'utf8');
    return conf;
  }

  getGitInfo(cwd = process.cwd()) {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { cwd, encoding: 'utf8' }).trim();
      const commit = execSync('git log -1 --format="%h - %s (%cr)" 2>/dev/null', { cwd, encoding: 'utf8' }).trim();
      const status = execSync('git status --porcelain 2>/dev/null', { cwd, encoding: 'utf8' }).trim();
      const modifiedCount = status ? status.split('\n').length : 0;
      return { branch: branch || 'none', lastCommit: commit || 'none', modifiedCount, isClean: modifiedCount === 0 };
    } catch {
      return { branch: 'non-git', lastCommit: 'none', modifiedCount: 0, isClean: true };
    }
  }

  getTasks() {
    try {
      return JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8'));
    } catch {
      return [];
    }
  }

  addTask({ title, priority = 'medium', category = 'feature', description = '' }) {
    const tasks = this.getTasks();
    const newId = `T-${tasks.length + 1}`;
    const task = {
      id: newId,
      title,
      priority,
      category,
      description,
      status: 'todo',
      created_at: new Date().toISOString()
    };
    tasks.push(task);
    fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2), 'utf8');
    return task;
  }

  completeTask(taskId) {
    const tasks = this.getTasks();
    const task = tasks.find(t => t.id.toLowerCase() === taskId.toLowerCase() || t.title.toLowerCase().includes(taskId.toLowerCase()));
    if (!task) return null;
    task.status = 'completed';
    task.completed_at = new Date().toISOString();
    fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2), 'utf8');
    return task;
  }

  getTestHistory() {
    try {
      return JSON.parse(fs.readFileSync(TESTS_PATH, 'utf8'));
    } catch {
      return [];
    }
  }

  recordTestRun({ suite = 'All Tests', passed = 0, failed = 0, skipped = 0, duration_ms = 0, coverage_pct = 0 }) {
    const history = this.getTestHistory();
    const entry = {
      timestamp: new Date().toISOString(),
      suite,
      passed,
      failed,
      skipped,
      duration_ms,
      coverage_pct
    };
    history.push(entry);
    fs.writeFileSync(TESTS_PATH, JSON.stringify(history, null, 2), 'utf8');
    return entry;
  }

  getExecutiveDigest(cwd = process.cwd()) {
    const git = this.getGitInfo(cwd);
    const conf = this.getConfig();
    const tasks = this.getTasks();
    const tests = this.getTestHistory();
    const latestTest = tests[tests.length - 1];

    const inProgress = tasks.filter(t => t.status === 'in_progress');
    const todo = tasks.filter(t => t.status === 'todo');

    let digest = `[PROJECT-ANCHOR EXECUTIVE DIGEST]\n`;
    digest += `Focus: "${conf.active_focus}" | Milestone: ${conf.active_milestone}\n`;
    digest += `Git Branch: [${git.branch}] ${git.isClean ? '✔ Clean working tree' : `⚠ ${git.modifiedCount} modified file(s)`}\n`;
    digest += `Last Commit: ${git.lastCommit}\n`;

    if (inProgress.length > 0) {
      digest += `Active Work: ${inProgress.map(t => `[${t.id}] ${t.title}`).join(', ')}\n`;
    } else if (todo.length > 0) {
      digest += `Next Up: [${todo[0].id}] ${todo[0].title}\n`;
    }

    if (latestTest) {
      digest += `Test Suite: ${latestTest.passed} passed, ${latestTest.failed} failed (${latestTest.coverage_pct}% coverage)\n`;
    }

    return digest;
  }
}

module.exports = ProjectManager;
