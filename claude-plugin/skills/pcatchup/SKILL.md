---
name: pcatchup
version: 1.0.0
description: Ingest today's chat messages, analyze consensus software engineering findings between developer and Claude, extract active plans, and record to CONFIRMED_FINDINGS.md and ACTIVE_PLAN.md.
allowed-tools:
  - Bash
  - mcp__anchor-labs-projects__project_catchup_chat
  - mcp__anchor-labs-projects__project_get_active_plan
---

# /pcatchup — Catch Up & Record Agreed Chat Findings

When the user runs `/pcatchup`, execute the following workflow:

1. Run the catchup command via Bash:
   ```bash
   anchor-labs-projects catchup
   ```
2. Display the confirmed findings and active plan to the user.
3. Verify that the developer, Claude, and Project Anchor all agree on the findings, test results, and next development steps.
