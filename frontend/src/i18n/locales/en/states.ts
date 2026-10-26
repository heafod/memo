// English resources (R8); keys 1:1 with zh/states.ts
export default {
  notFound: {
    code: "ERROR 404",
    title: "Page not found",
    description: "re looking for was moved, deleted, or never existed. Check the link or head back home.",
    back: "Back",
    home: "Go to Home"
  },
  forbidden: {
    code: "ERROR 403",
    title: "t have access",
    message: "{{name}} is a private project. You are not a member yet — ask {{who}} to add you.",
    owner: "the project owner",
    backToProjects: "Back to projects"
  },
  failed: {
    title: "Something went wrong.",
    description: "This page failed to load. Your data is safe — try again in a moment.",
    home: "Go to Home",
    retry: "Retry"
  },
  loading: "Loading…"
} as const;
