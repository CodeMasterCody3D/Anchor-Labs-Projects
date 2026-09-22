#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const resolveServer = require('./resolve-server');

const auditWizardMod = resolveServer('audit-wizard');
const SessionRouter = resolveServer('session-router');
const loadActiveContext = (auditWizardMod && auditWizardMod.loadActiveContext) 
  ? auditWizardMod.loadActiveContext 
  : () => ({ active_focus: 'General Development', active_milestone: 'v1.0 Milestone' });

let inputData = '';
process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    let prompt = '';
    let sessionId = null;
    let cwd = process.cwd();

    try {
      const parsed = JSON.parse(inputData);
      prompt = parsed.prompt || parsed.text || '';
      sessionId = parsed.session_id || null;
      cwd = parsed.cwd || process.cwd();
    } catch {
      prompt = inputData.trim();
    }

    let sessionMeta = { project_name: path.basename(cwd), session_id: sessionId || 'active' };
    if (SessionRouter) {
      try {
        const sr = new SessionRouter();
        sessionMeta = sr.recordActiveSession(sessionId, cwd);
      } catch {}
    }

    const ctx = loadActiveContext();
    const runtimeDir = path.join(process.env.HOME || '/home/cody', '.project-anchor');
    const tipsFile = path.join(runtimeDir, 'live_tips.json');
    let tips = {
      latest_finding_headline: 'Software architecture verified',
      current_plan_headline: 'Feature development and minimal test verification',
      active_files: [],
      scope_tip: 'Scope Check: If testing a single fix or command, run the minimal targeted test. Do not run full project rebuilds unless requested.'
    };
    try {
      if (fs.existsSync(tipsFile)) {
        tips = { ...tips, ...JSON.parse(fs.readFileSync(tipsFile, 'utf8')) };
      }
    } catch {}

    const isTestProbe = /(test|try|probe|can we|check|verify|fix|convert|single|quick)/i.test(prompt);
    const isFullPipeline = /(full build|release|publish|clean all|rebuild whole|ci\/cd|all tests)/i.test(prompt);

    let out = `\n<project-anchor-context>\n`;
    out += `# ⚓ PROJECT ANCHOR CO-PILOT CONTEXT & LIVE AGREE-STATE\n`;
    out += `- **Project**: ${sessionMeta.project_name || path.basename(cwd)} | **Session**: ${sessionMeta.session_id || 'active'}\n`;
    out += `- **Active Focus**: "${ctx.active_focus}" | **Milestone**: ${ctx.active_milestone}\n`;

    out += `\n### 🧭 ACTIVE PLAN & PROGRESSION:\n`;
    out += `- **Current Direction**: ${tips.current_plan_headline}\n`;
    out += `- **Latest Validated Finding**: ${tips.latest_finding_headline}\n`;
    if (tips.active_files && tips.active_files.length) {
      out += `- **Linked Files / Tools**: ${tips.active_files.map(f => `\`${f}\``).join(', ')}\n`;
    }

    out += `\n### 💡 PIPELINE MINIMALITY & ANTI-CONFUSION GUARD:\n`;
    if (isTestProbe && !isFullPipeline) {
      out += `⚠️ **TARGETED TASK DETECTED**: User is testing an isolated fix, command, or asset.\n`;
      out += `   • Run ONLY the minimal targeted test or converter command required.\n`;
      out += `   • DO NOT trigger full multi-package release builds or full end-to-end test suites.\n`;
      out += `   • If the command fails, isolate the minimal failing module before attempting wider refactors.\n`;
    } else if (isFullPipeline) {
      out += `ℹ️ **FULL SUITE / BUILD REQUESTED**: Verify working tree state before running full suite.\n`;
    } else {
      out += `• ${tips.scope_tip}\n`;
    }

    out += `</project-anchor-context>\n`;
    process.stdout.write(out);
  } catch {}
});
