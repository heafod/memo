# Memo 前端静态服务镜像（R14，001-plan PR-7）。
# 首版为占位页：PR-8 前端基座落地后，在此前置 Vite 构建阶段，
# 把构建产物 COPY 到 /usr/share/nginx/html 替换占位页。
FROM nginx:1.30-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/placeholder/ /usr/share/nginx/html/
