# FineSTEM MVP 部署文档 (v2.0 - 多项目兼容版)

## 1. 部署架构核心说明

**重要**：本项目采用"多项目并存"架构设计。
- **访问路径**：`http://<IP>/finestem` (所有资源均在此路径下)
- **API 路径**：`http://<IP>/finestem/api`
- **子功能**：Track A (`/finestem/track-a`) 和 Track E (`/finestem/track-e`) 均为项目内部路由，**非独立项目**。

## 2. 腾讯云 Lighthouse AI 部署指南

如果您使用腾讯云 Lighthouse 的 AI 助手进行部署，请提供以下信息：

1. **项目路径**：`/finestem`
2. **启动命令**：`docker-compose up -d --build`
3. **必需环境变量**：
   - `DEEPSEEK_API_KEY`: 您的 DeepSeek API 密钥 (用于 AI 聊天功能)

## 3. 手动部署步骤

### 3.1 环境准备
确保服务器已安装 Docker 和 Docker Compose。

### 3.2 部署操作

1. **获取代码**
   ```bash
   git clone https://github.com/fancyhf/fineSTEM.git
   cd finestem
   ```

2. **配置环境变量**
   在 `apps/public-web/src/features/mvp/phase1/backend/` 目录下创建 `.env` 文件，或直接在服务器环境变量中设置：
   ```bash
   DEEPSEEK_API_KEY=your_key_here
   ```

3. **启动服务**
   ```bash
   docker-compose up -d --build
   ```

4. **验证部署**
   - 访问首页：`http://<IP>/finestem`
   - 访问 Track E：`http://<IP>/finestem/track-e` (应正常加载，无 404/端口错误)
   - 验证 API：`http://<IP>/finestem/api/health` (应返回 `{"status": "ok"}`)

## 4. 故障排查

- **API 404**：检查 `docker-compose logs backend`，确认 `ROOT_PATH` 环境变量是否生效。
- **DeepSeek 连接失败**：检查 `docker-compose logs backend`，确认 `DEEPSEEK_API_KEY` 是否正确读取。
- **页面白屏**：检查浏览器控制台，确认资源加载路径是否以 `/finestem/assets/` 开头。

## 5. 维护信息
- **版本**: v2.0.0
- **更新时间**: 2025-12-28
- **维护者**: AI Agent
