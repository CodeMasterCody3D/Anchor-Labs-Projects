#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');

let inputData = '';
process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    let prompt = inputData;
    try {
      const parsed = JSON.parse(inputData);
      prompt = parsed.prompt || parsed.text || inputData;
    } catch {}

    const lower = prompt.toLowerCase();
    const hints = [];

    if (lower.includes('task') || lower.includes('todo') || lower.includes('backlog')) {
      hints.push('Project-Anchor tip: Use `/ptask` or `project-anchor tasks` to query or update tasks.');
    }
    if (lower.includes('graph') || lower.includes('chart') || lower.includes('plot')) {
      hints.push('Project-Anchor tip: Use `/pgraph` to generate clean high-contrast SVG project charts.');
    }
    if (lower.includes('remember') || lower.includes('i thought') || lower.includes('did we')) {
      hints.push('Project-Anchor tip: Use `/preconcile` to perform 3-way delta checks against git history.');
    }

    if (hints.length > 0) {
      process.stdout.write(`\n[Anchor Context]: ${hints.join(' | ')}\n`);
    }
  } catch {}
});
