---
name: pgraph
description: Generate high-contrast, clean SVG charts (test trends, burndown, task distribution, benchmarks, module metrics, radar)
---

# /pgraph — Universal Project Visualization

When this skill is invoked:
1. Parse optional chart type (`test_trend`, `burndown`, `task_distribution`, `benchmark`, `module_metrics`, `radar`) and title.
2. If chart type is omitted, automatically infer from available project state.
3. Call `project_generate_graph` MCP tool (or `project-anchor graph <type> "<title>"`).
4. Return the generated SVG path and display the key data points in Markdown.
5. All visualizations maintain strict color theory accessibility standards (slate dark cards, crisp light labels, vibrant distinct data accents) with zero meta-commentary on the chart itself.
