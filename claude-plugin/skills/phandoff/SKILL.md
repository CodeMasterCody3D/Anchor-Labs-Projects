---
name: phandoff
description: Generate an end-of-session handoff card for seamless morning pickup
---

# /phandoff — Session Handoff & Continuity

When this skill is invoked:
1. Capture any notes passed by the user (or summarize recent tool actions).
2. Call `project_handoff` MCP tool.
3. Formulate the morning handoff card including:
   - Current active focus & milestone.
   - Clean vs dirty git state and latest commit.
   - In-flight work left unfinished.
   - Immediate top task for tomorrow morning.
4. Ensure the developer or next agent session can resume with zero lost context in under 10 seconds.
