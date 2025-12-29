# 构建阶段
FROM node:18-alpine AS build

# 设置工作目录
WORKDIR /app

# 使用淘宝镜像源
RUN npm config set registry https://registry.npmmirror.com/

# 复制依赖文件和环境变量文件
COPY package*.json ./
COPY .env* ./

# 清除npm缓存并安装依赖
RUN npm cache clean --force && npm install --no-audit --no-fund

# 复制应用代码
COPY . .

# 构建生产版本（传入BASE_PATH和API_BASE_URL环境变量）
ARG BASE_PATH
ARG API_BASE_URL
ENV VITE_BASE_PATH=${BASE_PATH}
ENV VITE_API_BASE_URL=${API_BASE_URL}
RUN npm run build

# 运行阶段
FROM nginx:alpine

# 复制构建产物到 Nginx 静态目录
COPY --from=build /app/dist /usr/share/nginx/html

# 复制自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
