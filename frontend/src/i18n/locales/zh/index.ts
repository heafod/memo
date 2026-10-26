import activity from './activity';
import app from './app';
import auth from './auth';
import calendar from './calendar';
import date from './date';
import domain from './domain';
import errors from './errors';
import favorites from './favorites';
import home from './home';
import list from './list';
import myTasks from './myTasks';
import overview from './overview';
import project from './project';
import projects from './projects';
import shell from './shell';
import states from './states';
import task from './task';
import tasks from './tasks';
import timeline from './timeline';
import ui from './ui';
import write from './write';

// 中文资源（首版唯一语言，R8）；en 资源在 PR-11 补齐，key 与本文件一一对应。
export const zh = {
  activity,
  app,
  auth,
  calendar,
  date,
  domain,
  errors,
  favorites,
  home,
  list,
  myTasks,
  overview,
  project,
  projects,
  shell,
  states,
  task,
  tasks,
  timeline,
  ui,
  write,
} as const;
