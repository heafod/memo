import app from './app';
import auth from './auth';
import errors from './errors';
import home from './home';

// 中文资源（首版唯一语言，R8）；en 资源在 PR-11 补齐，key 与本文件一一对应。
export const zh = { app, auth, errors, home } as const;
