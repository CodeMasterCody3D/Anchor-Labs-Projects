---
name: preconcile
description: Perform 3-way memory delta reconciliation between user assumption, current code, and git history
---

# /preconcile — 3-Way Memory Reconciler ("Does that sound familiar?")

When this skill is invoked:
1. Accept the user's remembered design or assumption (e.g. `/preconcile "Didn't we use Redis for session caching?" src/cache.js`).
2. Call `project_reconcile` MCP tool.
3. Compare:
   - What the user remembered.
   - What is actually implemented right now in the files.
   - The git commit trail showing who changed it, when, and the commit message explaining why.
4. Output a clear 3-way reconciliation card asking whether to align with the current code or revert to the remembered behavior.
