---
name: psweep
description: Search past Claude Code transcripts for code snippets, error solutions, or prior discussions
---

# /psweep — Deep Transcript Search

When this skill is invoked:
1. Accept a query parameter (e.g. `/psweep "webpack config"` or `/psweep ENOTFOUND`).
2. Call `project_sweep_transcripts` MCP tool with the search string.
3. Return concise snippets matching the query across past session logs with exact file references.
4. Synthesize the historical solution or decision into actionable current context.
