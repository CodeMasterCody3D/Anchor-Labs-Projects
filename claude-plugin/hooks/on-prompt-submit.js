#!/usr/bin/env node
const fs = require('fs');
const resolveServer = require('./resolve-server');

const auditWizardMod = resolveServer('audit-wizard');
const loadActiveContext = (auditWizardMod && auditWizardMod.loadActiveContext) 
  ? auditWizardMod.loadActiveContext 
  : () => ({ active_focus: 'General Development', active_milestone: 'v1.0 Milestone' });

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

    const ctx = loadActiveContext();
    const lower = prompt.toLowerCase();
    const hints = [];

    if (lower.includes('task') || lower.includes('todo') || lower.includes('backlog')) {
      hints.push('Project-Anchor tip: Use `/ptask` or `anchor-labs-projects tasks` to query or update tasks.');
    }
    if (lower.includes('graph') || lower.includes('chart') || lower.includes('plot')) {
      hints.push('Project-Anchor tip: Use `/pgraph` to generate clean high-contrast SVG project charts.');
    }
    if (lower.includes('remember') || lower.includes('i thought') || lower.includes('did we')) {
      hints.push('Project-Anchor tip: Use `/preconcile` to perform 3-way delta checks against git history.');
    }

    let out = `\n[PROJECT-ANCHOR DIGEST]\nFocus: "${ctx.active_focus}" | Milestone: ${ctx.active_milestone}\n`;
    if (hints.length > 0) {
      out += `Context Guidance: ${hints.join(' | ')}\n`;
    }
    process.stdout.write(out);
  } catch {}
});
