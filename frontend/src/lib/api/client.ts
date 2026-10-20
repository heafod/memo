import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

// API 客户端：openapi-fetch + openapi-typescript 生成的 paths 类型（src/lib/api/schema.d.ts，
// 由 npm run gen:api 自 backend 导出的 openapi.json 生成；前端不手写任何 API 类型）。
// 同源请求（baseUrl 为空）：生产经 nginx /api 反代，开发经 Vite 代理，会话 Cookie 随请求携带。
export const api = createClient<paths>({ baseUrl: '', credentials: 'same-origin' });

const LOGIN_PATH = '/api/auth/login';

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler = () => {};

/** 由应用入口注册：任一请求 401 时调用（清缓存并回登录页，见 src/lib/query/client.ts）。 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

const unauthorizedMiddleware: Middleware = {
  onResponse({ request, response }) {
    // 登录请求本身不触发跳转：口令错误为 400，且登录页自行展示后端 detail
    if (response.status === 401 && new URL(request.url).pathname !== LOGIN_PATH) {
      onUnauthorized();
    }
    return response;
  },
};
api.use(unauthorizedMiddleware);

/** 从错误响应体提取后端 detail（R8：服务端 detail 首版固定中文）；非字符串 detail 返回 undefined。 */
export function errorDetail(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'detail' in error) {
    const { detail } = error;
    if (typeof detail === 'string' && detail.length > 0) return detail;
  }
  return undefined;
}

/** 携带 HTTP 状态与后端 detail 的请求错误（供 TanStack Query 的 error 使用）。 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | undefined;

  constructor(status: number, body: unknown) {
    const detail = errorDetail(body);
    super(detail ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}
