---
name: panchor
description: Display current project state, git branch/status, active focus, milestone, tasks, and test health
---

# /panchor — Project State & Executive Digest

When this skill is invoked:
1. Call the `project_get_state` MCP tool (or run `project-anchor status`) to retrieve:
   - Active project focus and milestone
   - Git branch, status (clean vs modified count), and last commit
   - Active task breakdown (in progress, completed, todo)
   - Latest test suite metrics (passed, failed, coverage %)
2. Present a clean, high-clarity Markdown card summarizing the repository status.
3. Suggest the immediate next task or priority.
