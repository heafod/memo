// English resources (R8); keys 1:1 with zh/project.ts
export default {
  tabs: {
    overview: "Overview",
    board: "Board",
    list: "List",
    table: "Table",
    calendar: "Calendar",
    timeline: "Timeline",
    files: "Files"
  },
  tabsLabel: "Project views",
  files: {
    search: "Search files",
    filterType: "Filter by type",
    allTypes: "All types",
    sortLabel: "Sort",
    sort: {
      date: "Newest",
      name: "Name",
      type: "Type"
    },
    gridView: "Grid view",
    listView: "List view",
    empty: "No files yet",
    noResults: "No results found",
    noResultsHint: "No files match your search.",
    columns: {
      name: "Name",
      type: "Type",
      size: "Size",
      by: "Uploaded by",
      date: "Date"
    },
    preview: "Preview",
    download: "Download",
    previewTitle: "Preview: {{name}}",
    noPreview: "This type cannot be previewed. Download to view.",
    meta: "{{size}} · {{by}} · {{when}}"
  },
  savedView: {
    save: 'Save view',
    saveTitle: 'Save view',
    saveDesc: 'Save the current filters as a tab on this project.',
    name: 'View name',
    namePh: 'e.g. Design review queue',
    layout: 'Layout',
    layoutList: 'List',
    layoutBoard: 'Board',
    layoutTable: 'Table',
    filtersHint: '{{n}} filters will be saved with this view.',
    filtersNone: 'No filters are active — the view will show all tasks. You can add filters after saving.',
    submit: 'Save view',
    rename: 'Rename',
    renameTitle: 'Rename view',
    delete: 'Delete view',
    deleteTitle: 'Delete "{{name}}"?',
    deleteBody: 'This view tab will be removed from the project. Tasks themselves are not deleted.',
    renamed: 'View renamed',
    deleted: 'View deleted',
    created: 'View saved',
  },
} as const;
