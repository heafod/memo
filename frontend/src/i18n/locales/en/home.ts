// English resources (R8); keys 1:1 with zh/home.ts
export default {
  greeting: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening"
  },
  title: "{{g}}，{{name}}",
  subtitle: "{{date}} · See what happened recently in your workspace.",
  dateLine: "{{wd}}, {{m}}/{{d}}",
  stats: {
    active: "Active projects",
    atRisk: "{{n}} at risk",
    open: "Open tasks",
    assignedToYou: "{{n}} assigned to you",
    completed: "Completed",
    thisWeek: "This week",
    overdue: "Overdue",
    needAttention: "need attention",
    onTrack: "all on track"
  },
  myTasks: {
    title: "My Tasks",
    tabs: {
      upcoming: "Upcoming",
      overdue: "Overdue",
      completed: "Completed"
    },
    open: "Open My Tasks",
    nothingOverdue: "Nothing overdue",
    nothingOverdueHint: "Every task assigned to you is on schedule.",
    empty: "No tasks here",
    viewAll: "View all {{n}} tasks"
  },
  progress: {
    title: "Project progress",
    all: "All projects",
    project: "Projects",
    status: "Status",
    progress: "Progress",
    due: "Due",
    team: "Teams"
  },
  deadlines: {
    title: "Upcoming deadlines",
    today: "Today",
    tomorrow: "Tomorrow",
    week: "This week",
    nothing: "Nothing due",
    more: "+{{n}} more"
  },
  activity: {
    title: "Recent activity"
  }
} as const;
