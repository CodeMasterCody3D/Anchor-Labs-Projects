#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AuditWizard {
  constructor(runtimeDir) {
    this.runtimeDir = runtimeDir || path.join(process.env.HOME || '/home/cody', '.project-anchor');
  }

  runFullAudit(cwd = process.cwd()) {
    const checks = [];

    // 1. Node.js Check
    try {
      const nodeVer = execSync('node --version 2>/dev/null', { encoding: 'utf8' }).trim();
      checks.push({ component: 'Node.js', status: 'OK', details: nodeVer });
    } catch {
      checks.push({ component: 'Node.js', status: 'FAIL', details: 'Node.js not found in PATH' });
    }

    // 2. Tmux Check (Crucial requirement)
    try {
      const tmuxVer = execSync('tmux -V 2>/dev/null', { encoding: 'utf8' }).trim();
      const tmuxPath = execSync('which tmux 2>/dev/null', { encoding: 'utf8' }).trim();
      checks.push({ component: 'tmux Daemon', status: 'OK', details: `${tmuxVer} (${tmuxPath})` });
    } catch {
      checks.push({ component: 'tmux Daemon', status: 'FAIL', details: 'tmux is not installed! Run: sudo apt install tmux' });
    }

    // 3. Git Check
    try {
      const gitVer = execSync('git --version 2>/dev/null', { encoding: 'utf8' }).trim();
      const isGitRepo = fs.existsSync(path.join(cwd, '.git'));
      checks.push({
        component: 'Git Engine',
        status: isGitRepo ? 'OK' : 'WARN',
        details: `${gitVer} | ${isGitRepo ? 'Current dir is Git repository' : 'Not inside a Git repository'}`
      });
    } catch {
      checks.push({ component: 'Git Engine', status: 'FAIL', details: 'Git not found in PATH' });
    }

    // 4. GitHub CLI (gh)
    try {
      const ghVer = execSync('gh --version 2>/dev/null', { encoding: 'utf8' }).split('\n')[0].trim();
      checks.push({ component: 'GitHub CLI', status: 'OK', details: ghVer });
    } catch {
      checks.push({ component: 'GitHub CLI', status: 'WARN', details: 'gh CLI not detected' });
    }

    // 5. Package Managers & Toolchains
    const tools = ['npm', 'pnpm', 'yarn', 'cargo', 'python3', 'go', 'make'];
    const detectedTools = [];
    tools.forEach(tool => {
      try {
        execSync(`which ${tool} 2>/dev/null`, { encoding: 'utf8' });
        detectedTools.push(tool);
      } catch {}
    });
    checks.push({
      component: 'Detected Toolchains',
      status: detectedTools.length > 0 ? 'OK' : 'WARN',
      details: detectedTools.join(', ') || 'No common build tools detected'
    });

    // 6. Runtime Storage & Anchor State
    const hasRuntime = fs.existsSync(this.runtimeDir);
    const hasTasks = fs.existsSync(path.join(this.runtimeDir, 'tasks.json'));
    const hasTests = fs.existsSync(path.join(this.runtimeDir, 'test_history.json'));

    checks.push({
      component: 'Anchor Storage',
      status: hasRuntime ? 'OK' : 'WARN',
      details: `${this.runtimeDir} (Tasks: ${hasTasks ? 'Present' : 'None'}, Tests: ${hasTests ? 'Present' : 'None'})`
    });

    const isHealthy = !checks.some(c => c.status === 'FAIL');

    return {
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      checks,
      summary: isHealthy
        ? 'All critical runtime and background daemon dependencies are satisfied.'
        : 'Action required: Some dependencies are missing. Please inspect failure items.'
    };
  }
}

module.exports = AuditWizard;
