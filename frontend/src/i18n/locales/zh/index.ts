import activity from './activity';
import app from './app';
import auth from './auth';
import calendar from './calendar';
import date from './date';
import domain from './domain';
import errors from './errors';
import home from './home';
import list from './list';
import myTasks from './myTasks';
import project from './project';
import projects from './projects';
import shell from './shell';
import states from './states';
import task from './task';
import ui from './ui';
import write from './write';

// 中文资源（首版唯一语言，R8）；en 资源在 PR-11 补齐，key 与本文件一一对应。
export const zh = { activity, app, auth, calendar, date, domain, errors, home, list, myTasks, project, projects, shell, states, task, ui, write } as const;
