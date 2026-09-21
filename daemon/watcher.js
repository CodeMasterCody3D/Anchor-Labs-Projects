#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ProjectManager = require('../server/project-manager');

const RUNTIME_DIR = path.join(process.env.HOME || '/home/cody', '.project-anchor');
const LOG_FILE = path.join(RUNTIME_DIR, 'worker.log');
const DIGEST_FILE = path.join(RUNTIME_DIR, 'current_digest.txt');

function log(msg) {
  const line = `[${new Date().toISOString()}] [project-anchor-worker] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch {}
  process.stdout.write(line);
}

log('Universal Project Anchor Daemon started.');

const pm = new ProjectManager();
let lastCommit = '';
let lastModifiedCount = -1;

function tick() {
  try {
    const cwd = process.cwd();
    const git = pm.getGitInfo(cwd);

    if (git.lastCommit !== lastCommit || git.modifiedCount !== lastModifiedCount) {
      log(`Git state changed: Branch=[${git.branch}] Commit=[${git.lastCommit}] ModifiedFiles=[${git.modifiedCount}]`);
      lastCommit = git.lastCommit;
      lastModifiedCount = git.modifiedCount;
    }

    // Refresh cached instant digest
    const digest = pm.getExecutiveDigest(cwd);
    fs.writeFileSync(DIGEST_FILE, digest, 'utf8');
  } catch (err) {
    log(`Worker tick warning: ${err.message}`);
  }
}

// Initial tick
tick();

// Run every 10 seconds
setInterval(tick, 10000);

process.on('SIGINT', () => {
  log('Worker received SIGINT, stopping gracefully.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Worker received SIGTERM, stopping gracefully.');
  process.exit(0);
});
