# argus-frontend 镜像（GH Actions tag 构建；静态 SPA + 同源 /api 反代）。
# 基础镜像钉 1.27-alpine（与 43 节点已缓存镜像一致，离线导入友好）。
FROM nginx:1.27-alpine
COPY dist/ /usr/share/nginx/html/
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
