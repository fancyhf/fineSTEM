# 概述

在腾讯云 Lighthouse 单台服务器上部署多个项目。每个项目独立运行，通过路径区分访问。**fineSTEM 是服务器上的其中一个项目**。

关于多项目部署，可参考这个文档[多项目部署指南 - Lighthouse 服务器](deploysettings/MULTI_PROJECT_DEPLOYMENT.md)

## ⚠️ 关键架构说明

### 服务器架构（多项目部署）

```
Lighthouse 服务器 (80 端口)
├── 主机级 Nginx (路径分发)
│   ├── /project1 → project1 容器
│   ├── /project2 → project2 容器
│   └── /finestem → fineSTEM 容器
└── fineSTEM 项目（其中一个）
    ├── Home (首页)
    ├── TrackA (子页签：双摆混沌模拟)
    └── TrackE (子页签：编程语言热度)
```

### 核心原则

- **多项目服务器**：Lighthouse 支持多项目部署，fineSTEM 是其中一个项目
- **项目独立性**：每个项目有独立的容器、独立的端口、独立的网络
- **项目内部子路由**：track-a、track-e 是 fineSTEM 内部的 React Router 子路由，**不是服务器级别的独立项目**
- **路径分离**：
  - 服务器级别：通过不同路径区分不同项目（`/finestem`、`/project1`、`/project2`）
  - 项目内部：通过 React Router 区分子页签（`/track-a`、`/track-e`）

### URL 结构

#### 服务器级别（项目区分）

- **项目 1 入口**：`http://43.140.204.127/project1`
- **项目 2 入口**：`http://43.140.204.127/project2`
- **fineSTEM 入口**：`http://43.140.204.127/finestem`

#### fineSTEM 项目内部（子页签）

- **主页面**：`http://43.140.204.127/finestem/`
- **子页签 A**：`http://43.140.204.127/finestem/track-a`
- **子页签 E**：`http://43.140.204.127/finestem/track-e`
- **API 路径**：`http://43.140.204.127/finestem/api/*`

### 🚫 严禁行为

- ❌ 将 track-a、track-e 作为服务器级别的独立项目部署
- ❌ 为 fineSTEM 的子页签分配独立的容器或端口
- ❌ 在主机 Nginx 中配置 track-a、track-e 的路由
- ❌ 将 track-a/e 与 project1、project2 等同列为服务器项目
- ❌ 使用硬编码的 URL 或端口

### 部署架构

```
Lighthouse 服务器 (80 端口)
    ↓
主机级 Nginx (路径分发)
    ├── /project1 → project1-frontend 容器 (8081:80)
    ├── /project2 → project2-frontend 容器 (8082:80)
    └── /finestem → finestem-frontend 容器 (80:80)
              ├── /finestem → React 应用
              └── /api → finestem-backend 容器 (8000:8000)
```

**关键点**：

- 主机 Nginx 只负责根据路径分发到不同项目容器
- 每个项目有独立的前端容器和后端容器（如果需要）
- 项目的内部子路由（如 track-a、track-e）由项目自己处理

## 1. 服务器目录结构

```
/opt/
└── projects/              # 所有项目的根目录
    ├── finestem/         # fineSTEM 项目
    │   ├── app/         # 代码目录（git clone）
    │   ├── data/        # 数据卷（可选）
    │   └── logs/        # 日志卷（可选）
    ├── project2/         # 其他项目
    │   ├── app/
    │   └── logs/
    └── project3/
        ├── app/
        └── logs/
```

## 2. 端口分配

| 项目  | 前端容器端口 | 后端容器端口 | 访问路径 | 完整 URL |
| --- | --- | --- | --- | --- |
| finestem | 80  | 8000 | /finestem | http://43.140.204.127/finestem |
| project2 | 8081 | 18081 | /project2 | http://43.140.204.127/project2 |
| project3 | 8082 | 18082 | /project3 | http://43.140.204.127/project3 |

**注意**：

- 前端容器端口映射到主机，主机 Nginx 路由到对应端口
  
- 后端容器端口仅用于容器间通信，不对外暴露
  
- fineSTEM 使用 80 端口（可直接通过域名根路径访问，或通过 /finestem 路径）概述
  
  本指南适用于在腾讯云 Lighthouse 单台服务器上部署多个项目。每个项目独立运行，通过路径区分访问。**fineSTEM 是服务器上的其中一个项目**。
  
  ## ⚠️ 关键架构说明
  
  ### 服务器架构（多项目部署）
  
  ```
  Lighthouse 服务器 (80 端口)
  ├── 主机级 Nginx (路径分发)
  │   ├── /project1 → project1 容器
  │   ├── /project2 → project2 容器
  │   └── /finestem → fineSTEM 容器
  └── fineSTEM 项目（其中一个）
      ├── Home (首页)
      ├── TrackA (子页签：双摆混沌模拟)
      └── TrackE (子页签：编程语言热度)
  ```
  
  ### 核心原则
  
  - **多项目服务器**：Lighthouse 支持多项目部署，fineSTEM 是其中一个项目
  - **项目独立性**：每个项目有独立的容器、独立的端口、独立的网络
  - **项目内部子路由**：track-a、track-e 是 fineSTEM 内部的 React Router 子路由，**不是服务器级别的独立项目**
  - **路径分离**：
    - 服务器级别：通过不同路径区分不同项目（`/finestem`、`/project1`、`/project2`）
    - 项目内部：通过 React Router 区分子页签（`/track-a`、`/track-e`）
  
  ### URL 结构
  
  #### 服务器级别（项目区分）
  
  - **项目 1 入口**：`http://43.140.204.127/project1`
  - **项目 2 入口**：`http://43.140.204.127/project2`
  - **fineSTEM 入口**：`http://43.140.204.127/finestem`
  
  #### fineSTEM 项目内部（子页签）
  
  - **主页面**：`http://43.140.204.127/finestem/`
  - **子页签 A**：`http://43.140.204.127/finestem/track-a`
  - **子页签 E**：`http://43.140.204.127/finestem/track-e`
  - **API 路径**：`http://43.140.204.127/finestem/api/*`
  
  ### 🚫 严禁行为
  
  - ❌ 将 track-a、track-e 作为服务器级别的独立项目部署
  - ❌ 为 fineSTEM 的子页签分配独立的容器或端口
  - ❌ 在主机 Nginx 中配置 track-a、track-e 的路由
  - ❌ 将 track-a/e 与 project1、project2 等同列为服务器项目
  - ❌ 使用硬编码的 URL 或端口
  
  ### 部署架构
  
  ```
  Lighthouse 服务器 (80 端口)
      ↓
  主机级 Nginx (路径分发)
      ├── /project1 → project1-frontend 容器 (8081:80)
      ├── /project2 → project2-frontend 容器 (8082:80)
      └── /finestem → finestem-frontend 容器 (80:80)
                ├── /finestem → React 应用
                └── /api → finestem-backend 容器 (8000:8000)
  ```
  
  **关键点**：
  
  - 主机 Nginx 只负责根据路径分发到不同项目容器
  - 每个项目有独立的前端容器和后端容器（如果需要）
  - 项目的内部子路由（如 track-a、track-e）由项目自己处理
  
  ## 1. 服务器目录结构
  
  ```
  /opt/
  └── projects/              # 所有项目的根目录
      ├── finestem/         # fineSTEM 项目
      │   ├── app/         # 代码目录（git clone）
      │   ├── data/        # 数据卷（可选）
      │   └── logs/        # 日志卷（可选）
      ├── project2/         # 其他项目
      │   ├── app/
      │   └── logs/
      └── project3/
          ├── app/
          └── logs/
  ```
  
  ## 2. 端口分配
  
  | 项目  | 前端容器端口 | 后端容器端口 | 访问路径 | 完整 URL |
  | --- | --- | --- | --- | --- |
  | finestem | 80  | 8000 | /finestem | http://43.140.204.127/finestem |
  | project2 | 8081 | 18081 | /project2 | http://43.140.204.127/project2 |
  | project3 | 8082 | 18082 | /project3 | http://43.140.204.127/project3 |
  
  **注意**：
  
  - 前端容器端口映射到主机，主机 Nginx 路由到对应端口
  - 后端容器端口仅用于容器间通信，不对外暴露
  - fineSTEM 使用 80 端口（可直接通过域名根路径访问，或通过 /finestem 路径）