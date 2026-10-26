// English resources (R8); keys 1:1 with zh/list.ts
export default {
  columns: {
    task: "Tasks",
    status: "Status",
    assignee: "Assignee",
    priority: "Priority",
    due: "Due date",
    labels: "Labels",
    project: "Projects"
  },
  search: "Search tasks",
  sortLabel: "Sort",
  groupLabel: "Group",
  sort: {
    manual: "Manual",
    title: "Title",
    due: "Due date",
    priority: "Priority",
    status: "Status",
    assignee: "Assignee",
    created: "Created",
    updated: "Updated"
  },
  group: {
    status: "Status",
    priority: "Priority",
    assignee: "Assignee",
    project: "Projects",
    due: "Due date",
    none: "None"
  },
  dueGroup: {
    overdue: "Overdue",
    today: "Today",
    week: "Next 7 days",
    later: "Later",
    nodate: "No due date"
  },
  allTasks: "All tasks",
  unassigned: "Unassigned",
  selectAll: "Select all",
  selectTask: "Select “{{title}}”",
  selected: "{{n}} selected",
  toggleGroup: "Toggle group",
  showSubtasks: "Show subtasks",
  hideSubtasks: "Hide subtasks",
  emptyTitle: "No tasks here",
  noResults: "No tasks match your search",
  filterIs: "is",
  filterNot: "is not",
  filterUpdated: "Updated",
  filterLast7Days: "Last 7 days",
  filterOverdue: "Overdue",
  removeFilter: "Remove filter",
  removePresetFilter: "Clear filters"
} as const;
