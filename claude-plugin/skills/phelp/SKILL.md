---
name: phelp
description: Show complete reference guide and cheat sheet for Project-Anchor slash commands and CLI
---

# /phelp — Project Anchor Command Directory

When this skill is invoked, present a quick-reference cheat sheet:

```
Slash Commands:
  /panchor              Display current state, git status, active tasks, test health
  /ptask [list|add|done] Manage task registry (e.g. /ptask add "Refactor auth" high)
  /pscan                Scan git log & transcripts into DOSSIER and FAILURE_GRAVEYARD
  /psweep <query>       Search past session transcripts for solutions & discussions
  /pgraph [type]        Generate clean SVG chart (test_trend, burndown, radar, etc.)
  /preconcile "<memory>" [file] 3-way delta verification (User vs Code vs Git history)
  /phandoff [notes]     Generate end-of-session handoff card
  /pcheck               Audit supervisor governance, historical scan & subagents
  /panchorcheck         Full alias for /pcheck
  /phelp                Show this command directory

CLI Commands (anchor-labs-projects <cmd> or project-anchor <cmd>):
  doctor                Audit Node.js, tmux daemon, Git, and build tools
  status                Full project snapshot and executive digest
  check                 Audit supervisor governance, scan progress & subagents
  focus <text>          Set active project focus & milestone
  tasks                 Interactive task list
  task add|done         Add or complete tasks
  test record           Log test suite results
  graph [type]          Render SVG chart
  scan                  Scan commits into dossier & failure graveyard
  reconcile             Perform 3-way delta reconciliation
  daemon start|stop     Manage persistent background tmux worker
```
