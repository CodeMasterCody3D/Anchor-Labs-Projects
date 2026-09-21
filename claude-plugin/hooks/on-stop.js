#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ProjectManager = require('../../server/project-manager');

const RUNTIME_DIR = path.join(process.env.HOME || '/home/cody', '.project-anchor');
const DIGEST_FILE = path.join(RUNTIME_DIR, 'current_digest.txt');

try {
  const pm = new ProjectManager();
  const digest = pm.getExecutiveDigest(process.cwd());
  fs.writeFileSync(DIGEST_FILE, digest, 'utf8');
  process.stdout.write(`\n[PROJECT-ANCHOR] State checkpoint saved to ${DIGEST_FILE}\n`);
} catch (err) {}
