---
name: pscan
description: Scan git commit history and past session transcripts to synthesize PROJECT_DOSSIER.md and FAILURE_GRAVEYARD.md
---

# /pscan — Architectural & Failure History Scanner

When this skill is invoked:
1. Call `project_scan_history` MCP tool (or run `project-anchor scan`).
2. Analyze recent git commits and transcript files to identify:
   - Architectural milestones and interface evolutions.
   - Historical bug fixes, regressions, and pitfalls.
3. Automatically update:
   - `~/.project-anchor/PROJECT_DOSSIER.md`
   - `~/.project-anchor/FAILURE_GRAVEYARD.md`
4. Report the number of commits scanned and highlight the top 3 failure traps to watch out for during current session.
