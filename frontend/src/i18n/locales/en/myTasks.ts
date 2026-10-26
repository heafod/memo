// English resources (R8); keys 1:1 with zh/myTasks.ts
export default {
  title: "My Tasks",
  summary: "Due today {{a}} · Overdue {{b}} · Upcoming {{c}}",
  groups: {
    overdue: "Overdue",
    today: "Today",
    upcoming: "Upcoming",
    completed: "Completed"
  },
  viewLabel: "View",
  view: {
    list: "List",
    calendar: "Calendar"
  }
} as const;
