# 部署架构诊断报告

**文档版本**: v1.0.0  
**创建时间**: 2025-12-27  
**维护者**: AI Agent  
**状态**: 初稿

---

## 1. 问题概述

### 1.1 用户反馈的核心问题

1. **架构理解错误**：track-a、track-e 是 fineSTEM 的子页签，不是独立项目
2. **子页签访问错误**：子页签内容出不来，报 8001 端口错误
3. **错误根源反复出现**：修改后偶尔改好，又被"不小心"改回去
4. **硬编码问题未解决**：Base URL、端口等硬编码问题依然存在
- **API路由404错误**
  
  - 前端请求: `/api/track-e/dataset/mock`
  - Nginx代理配置: `location /api { proxy_pass http://backend:8000; }`
  - 后端路由定义: `@app.include_router(track_e_router, prefix="/track-e")`
  - 问题: Nginx转发`/api/track-e/dataset/mock`给后端，但后端期望`/track-e/dataset/mock`

- **根路径重定向错误**
  
  - 当前配置: `location = / { return 301 /finestem; }`
  - 问题: 项目列表页面被跳过，违背多项目架构设计

- **环境一致性风险**
  
  - 本地与服务器配置不一致可能导致部署后突然故障
  
  

### 1.2 当前部署的错误行为

- 访问 `http://43.140.204.127/track-e` 时，报端口错误
- 前端资源（JS/CSS）从根路径读取，而非 `/finestem/assets`
- API 请求路径配置错误，导致后端调用失败
- 误以为 track-a/track-e 需要独立端口或平级部署

---

## 2. 架构现状分析

### 2.1 正确的项目层级关系

```
fineSTEM (主项目，唯一项目)
├── Home (首页)
│   ├── → /track-a (跳转到 TrackA 子页签)
│   └── → /track-e (跳转到 TrackE 子页签)
├── TrackA (子页签：双摆混沌模拟)
└── TrackE (子页签：编程语言热度)
```

**关键理解**：

- **多项目服务器**：Lighthouse 服务器支持多项目部署，fineSTEM 是其中一个项目
- **fineSTEM 内部结构**：包含多个子页签（Home、TrackA、TrackE）
- **子页签**：track-a、track-e 是 fineSTEM 内部的 React Router 子路由
- **不需要独立容器/端口**：子页签共享 fineSTEM 的前端容器
- **访问方式**：
  - 主入口：`http://43.140.204.127/finestem`
  - 子页签 A：`http://43.140.204.127/finestem/track-a`
  - 子页签 E：`http://43.140.204.127/finestem/track-e`

### 