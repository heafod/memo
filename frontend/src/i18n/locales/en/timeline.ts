// English resources (R8); keys 1:1 with zh/timeline.ts
export default {
  title: "Timeline",
  subtitle: "Schedules, dependencies, and milestones across projects.",
  zoomLabel: "Time scale",
  zoom: {
    week: "Week",
    month: "Month"
  },
  groupLabel: "Group by",
  group: {
    status: "Group: Status",
    assignee: "Group: Assignee",
    project: "Group: Project",
    none: "No grouping"
  },
  today: "Today",
  task: "Tasks",
  milestones: "Milestones",
  milestone: "Milestone: {{x}}",
  msOf: "{{name}}（{{project}}）",
  monthLabel: "{{mon}} {{y}}",
  dayLabel: "{{m}}/{{d}}",
  empty: "Nothing on the timeline",
  emptyHint: "Give tasks a start and due date to see them here.",
  movedLater: "Moved “{{title}}” later by {{n}} days",
  movedEarlier: "Moved “{{title}}” earlier by {{n}} days"
} as const;
