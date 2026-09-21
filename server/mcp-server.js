#!/usr/bin/env node
const readline = require('readline');
const ProjectManager = require('./project-manager');
const MemoryReconciler = require('./reconciler');
const GraphEngine = require('./graph-engine');
const HistoricalSynthesizer = require('./historical-synthesizer');
const AuditWizard = require('./audit-wizard');

const pm = new ProjectManager();
const reconciler = new MemoryReconciler();
const graphEngine = new GraphEngine();
const synthesizer = new HistoricalSynthesizer();
const auditor = new AuditWizard();

const TOOLS = [
  {
    name: 'project_get_state',
    description: 'Retrieve current project state including git status, active focus, open tasks, and test results',
    inputSchema: { type: 'object', properties: { cwd: { type: 'string' } } }
  },
  {
    name: 'project_digest',
    description: 'Get a concise ~300-token executive digest of current project state for session priming',
    inputSchema: { type: 'object', properties: { cwd: { type: 'string' } } }
  },
  {
    name: 'project_set_focus',
    description: 'Update the active focus and milestone of the project',
    inputSchema: {
      type: 'object',
      properties: {
        focus: { type: 'string', description: 'What the team or agent is currently focusing on' },
        milestone: { type: 'string', description: 'Active milestone (e.g. v1.0, Sprint 4)' }
      },
      required: ['focus']
    }
  },
  {
    name: 'project_task_add',
    description: 'Add a new task to the project task registry',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        category: { type: 'string', description: 'Category e.g. feature, bug, refactor, test' },
        description: { type: 'string', description: 'Detailed notes on task' }
      },
      required: ['title']
    }
  },
  {
    name: 'project_task_list',
    description: 'List project tasks with optional status filter',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'todo', 'in_progress', 'completed'] }
      }
    }
  },
  {
    name: 'project_task_complete',
    description: 'Mark a task as completed by ID or matching title',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (e.g. T-1) or keyword' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'project_record_test',
    description: 'Record test suite results into project historical test ledger',
    inputSchema: {
      type: 'object',
      properties: {
        suite: { type: 'string', description: 'Name of the test suite' },
        passed: { type: 'number' },
        failed: { type: 'number' },
        skipped: { type: 'number' },
        duration_ms: { type: 'number' },
        coverage_pct: { type: 'number' }
      },
      required: ['passed', 'failed']
    }
  },
  {
    name: 'project_reconcile',
    description: 'Perform a 3-way memory delta reconciliation between user memory, current code, and git history',
    inputSchema: {
      type: 'object',
      properties: {
        rememberedAssumption: { type: 'string', description: 'What was recalled or assumed' },
        targetFile: { type: 'string', description: 'Target file in repo' },
        symbolName: { type: 'string', description: 'Function or symbol name' }
      },
      required: ['rememberedAssumption']
    }
  },
  {
    name: 'project_scan_history',
    description: 'Scan git commits and transcripts to generate PROJECT_DOSSIER.md and FAILURE_GRAVEYARD.md',
    inputSchema: { type: 'object', properties: { cwd: { type: 'string' } } }
  },
  {
    name: 'project_sweep_transcripts',
    description: 'Grep session transcripts for previous solutions, discussions, or bug investigations',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or error message' },
        limit: { type: 'number' }
      },
      required: ['query']
    }
  },
  {
    name: 'project_generate_graph',
    description: 'Generate high-contrast SVG visualization (test_trend, burndown, task_distribution, benchmark, module_metrics, radar)',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['test_trend', 'burndown', 'task_distribution', 'benchmark', 'module_metrics', 'radar'] },
        title: { type: 'string' },
        filename: { type: 'string' },
        data: { type: 'object' }
      }
    }
  },
  {
    name: 'project_audit',
    description: 'Audit development environment for Node, tmux, Git, and build toolchains',
    inputSchema: { type: 'object', properties: { cwd: { type: 'string' } } }
  },
  {
    name: 'project_handoff',
    description: 'Generate an end-of-session handoff summary for seamless next-morning pickup',
    inputSchema: { type: 'object', properties: { notes: { type: 'string' } } }
  }
];

function handleToolCall(name, args = {}) {
  const cwd = args.cwd || process.cwd();

  switch (name) {
    case 'project_get_state': {
      const git = pm.getGitInfo(cwd);
      const conf = pm.getConfig();
      const tasks = pm.getTasks();
      const tests = pm.getTestHistory();
      return {
        focus: conf.active_focus,
        milestone: conf.active_milestone,
        git,
        tasks,
        latestTest: tests[tests.length - 1] || null
      };
    }
    case 'project_digest': {
      return { digest: pm.getExecutiveDigest(cwd) };
    }
    case 'project_set_focus': {
      return pm.setFocus(args.focus, args.milestone);
    }
    case 'project_task_add': {
      return pm.addTask(args);
    }
    case 'project_task_list': {
      const all = pm.getTasks();
      if (!args.status || args.status === 'all') return all;
      return all.filter(t => t.status === args.status);
    }
    case 'project_task_complete': {
      const res = pm.completeTask(args.taskId);
      return res || { error: `Task ${args.taskId} not found` };
    }
    case 'project_record_test': {
      return pm.recordTestRun(args);
    }
    case 'project_reconcile': {
      const report = reconciler.reconcile({
        rememberedAssumption: args.rememberedAssumption,
        targetFile: args.targetFile,
        symbolName: args.symbolName,
        cwd
      });
      return { report };
    }
    case 'project_scan_history': {
      return synthesizer.scanProjectHistory(cwd);
    }
    case 'project_sweep_transcripts': {
      return synthesizer.sweepTranscripts(args.query, args.limit || 10);
    }
    case 'project_generate_graph': {
      let chartData = args.data;
      if (!chartData) {
        if (args.type === 'test_trend') chartData = pm.getTestHistory();
        else if (args.type === 'task_distribution') chartData = pm.getTasks();
      }
      return graphEngine.generateChart({
        type: args.type,
        title: args.title,
        data: chartData,
        filename: args.filename
      });
    }
    case 'project_audit': {
      return auditor.runFullAudit(cwd);
    }
    case 'project_handoff': {
      const git = pm.getGitInfo(cwd);
      const tasks = pm.getTasks();
      const conf = pm.getConfig();
      const inProgress = tasks.filter(t => t.status === 'in_progress');
      const todo = tasks.filter(t => t.status === 'todo');

      const handoff = `
=====================================================
[PROJECT-ANCHOR MORNING HANDOFF CARD]
Generated: ${new Date().toISOString()}
Focus: ${conf.active_focus} | Milestone: ${conf.active_milestone}
Branch: ${git.branch} (${git.isClean ? 'Clean working tree' : `${git.modifiedCount} uncommitted files`})
Last Commit: ${git.lastCommit}
-----------------------------------------------------
Active Work Left In-Flight:
${inProgress.length > 0 ? inProgress.map(t => `  • [${t.id}] ${t.title}`).join('\n') : '  • No in-progress tasks.'}

Top Priority For Next Session:
${todo.length > 0 ? `  • [${todo[0].id}] ${todo[0].title}` : '  • Backlog clear.'}

Session Closing Notes:
  ${args.notes || 'Normal clean session wrap.'}
=====================================================
`.trim();
      return { handoff };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// JSON-RPC stdio loop
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    if (req.method === 'initialize') {
      const res = {
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'project-anchor-mcp', version: '1.0.0' }
        }
      };
      process.stdout.write(JSON.stringify(res) + '\n');
    } else if (req.method === 'tools/list') {
      const res = {
        jsonrpc: '2.0',
        id: req.id,
        result: { tools: TOOLS }
      };
      process.stdout.write(JSON.stringify(res) + '\n');
    } else if (req.method === 'tools/call') {
      const { name, arguments: args } = req.params;
      try {
        const output = handleToolCall(name, args);
        const res = {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            content: [{ type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output, null, 2) }]
          }
        };
        process.stdout.write(JSON.stringify(res) + '\n');
      } catch (err) {
        const res = {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            content: [{ type: 'text', text: `Error: ${err.message}` }],
            isError: true
          }
        };
        process.stdout.write(JSON.stringify(res) + '\n');
      }
    }
  } catch (err) {
    // Ignore invalid JSON lines
  }
});
