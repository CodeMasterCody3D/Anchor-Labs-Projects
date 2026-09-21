---
name: panchorcheck
description: Audit project supervisor governance invariants (no drift, no unstructured web searches), check historical scan progress, and monitor background subagent tasks (alias for /pcheck)
---

# /panchorcheck — Project Supervisor & Subagent Audit (Alias)

When this skill is invoked:
1. Call the `project_check` MCP tool (or run `anchor-labs-projects check` via Bash).
2. Report the 3-pillar project oversight card:
   - **Main Project Anchor Supervisor**: Confirm role as Central Controller & Supervisor, verify Anti-Drift Guard (zero stray web searches; subagents handle isolated work), and show active focus/milestone.
   - **Historical Project Synthesizer Status**: Show if scan is running, completed, or idle, including commits analyzed and traps cataloged in `FAILURE_GRAVEYARD.md`.
   - **Spawned Subagents & Worker Fleet**: Check `project-anchor-worker` tmux daemon, in-flight tasks, and latest test health.
