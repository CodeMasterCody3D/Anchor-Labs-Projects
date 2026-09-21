---
name: ptask
description: Manage project tasks (list, add, complete, prioritize)
---

# /ptask — Project Task Registry

When this skill is invoked:
1. Parse user arguments to determine task operation:
   - **List**: `project_task_list` (filter by `todo`, `in_progress`, `completed`, or `all`).
   - **Add**: `project_task_add` with `title`, optional `priority` (low, medium, high, critical), and `category`.
   - **Complete**: `project_task_complete` by taskId (e.g. `T-2`) or keyword.
2. If no arguments are provided, display all active tasks in a clean tabular format.
3. Automatically link new tasks to active milestone or branch context.
