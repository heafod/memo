# Memo 前端静态服务镜像（R14 / R16，001-plan PR-7 / PR-8）。
# 构建阶段：Node 22（与 frontend/.nvmrc 一致），命令与本地完全相同——npm ci + npm run build
# （build = tsc -b && vite build）。API 类型 src/lib/api/schema.d.ts 已随仓提交，构建不依赖 backend。
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段：nginx 托管构建产物；/api 反代 backend，其余路径 try_files 回退 index.html（History 路由）
FROM nginx:1.30-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
