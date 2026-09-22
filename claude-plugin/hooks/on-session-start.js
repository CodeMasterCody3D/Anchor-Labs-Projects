#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const resolveServer = require('./resolve-server');
const ProjectManager = resolveServer('project-manager');

const RUNTIME_DIR = path.join(process.env.HOME || '/home/cody', '.project-anchor');
const DIGEST_FILE = path.join(RUNTIME_DIR, 'current_digest.txt');

try {
  let digest = '';
  if (fs.existsSync(DIGEST_FILE)) {
    digest = fs.readFileSync(DIGEST_FILE, 'utf8');
  } else if (ProjectManager) {
    const pm = new ProjectManager();
    digest = pm.getExecutiveDigest(process.cwd());
  }
  process.stdout.write(`\n${digest}\n`);
} catch (err) {
  // Silent fallback
}
