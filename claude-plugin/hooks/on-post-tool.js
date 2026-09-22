#!/usr/bin/env node
const resolveServer = require('./resolve-server');
const ProjectManager = resolveServer('project-manager');

let input = '';
process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    let outputText = input;
    let commandLine = '';
    try {
      const parsed = JSON.parse(input);
      outputText = parsed.tool_result || parsed.output || input;
      commandLine = (parsed.tool_input && (parsed.tool_input.command || parsed.tool_input.CommandLine)) || '';
    } catch {}

    // Check if tool execution was a test runner
    if (/npm\s+test|pytest|cargo\s+test|go\s+test/i.test(commandLine) && ProjectManager) {
      const pm = new ProjectManager();
      
      // Match common test patterns like "X passed, Y failed"
      let passed = 0;
      let failed = 0;

      const passedMatch = outputText.match(/(\d+)\s+passed/i);
      const failedMatch = outputText.match(/(\d+)\s+failed/i);

      if (passedMatch) passed = parseInt(passedMatch[1], 10);
      if (failedMatch) failed = parseInt(failedMatch[1], 10);

      if (passed > 0 || failed > 0) {
        pm.recordTestRun({
          suite: commandLine.trim(),
          passed,
          failed,
          duration_ms: 0
        });
      }
    }
  } catch {}
});
