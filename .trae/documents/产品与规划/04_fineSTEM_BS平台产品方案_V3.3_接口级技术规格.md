# fineSTEM B/S 平台产品方案 V3.3 接口级技术规格（学生版）

**版本**: v1.1
**日期**: 2026-04-24
**状态**: 草案
**用途**: 定义学生主闭环所需的最小接口集合

---

## 1. 设计范围

本规格仅覆盖学生主闭环：

`Demo -> fork -> 轻项目 -> 成果档案卡 -> 分享链接`

---

## 2. API 分组

### 2.1 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录 |
| GET | `/api/v1/auth/me` | 获取当前用户 |

### 2.2 Demo 与探索

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/demos` | Demo 列表（支持筛选与搜索） |
| GET | `/api/v1/demos/{demoId}` | Demo 详情 |
| POST | `/api/v1/demos/{demoId}/fork` | 创建 fork 项目 |

### 2.3 项目与进度

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/projects` | 我的项目列表 |
| POST | `/api/v1/projects` | 创建项目 |
| GET | `/api/v1/projects/{projectId}` | 项目详情 |
| POST | `/api/v1/projects/{projectId}/progress/light/{step}` | 保存轻项目步骤 |
| POST | `/api/v1/projects/{projectId}/progress/standard/{stage}` | 保存标准研学阶段数据 |
| POST | `/api/v1/projects/{projectId}/advance` | 推进下一阶段 |
| GET | `/api/v1/projects/{projectId}/progress` | 获取完整进度 |

### 2.4 成果档案卡与分享

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/achievement-cards` | 创建成果档案卡 |
| GET | `/api/v1/achievement-cards/{cardId}` | 档案卡详情 |
| POST | `/api/v1/achievement-cards/{cardId}/share-link` | 生成或刷新分享链接 |
| POST | `/api/v1/achievement-cards/{cardId}/publish` | 发布到灵感墙 |
| POST | `/api/v1/achievement-cards/{cardId}/unpublish` | 从灵感墙撤回 |
| GET | `/api/v1/inspiration-wall` | 灵感墙列表 |

### 2.5 AI 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/chat/completions` | 发送消息（HTTP） |
| GET | `/api/v1/chat/history/{projectId}` | 获取项目对话历史 |
| DELETE | `/api/v1/chat/history/{projectId}` | 清空项目对话历史 |

### 2.6 代码编辑与运行

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/sandbox/execute` | 执行代码（JS 优先） |
| GET | `/api/v1/projects/{projectId}/code` | 获取项目代码 |
| POST | `/api/v1/projects/{projectId}/code/save` | 保存项目代码 |

---

## 3. 统一数据约束

### 3.1 审计字段

```text
AuditFields {
  createdAt: timestamp
  createdBy: string
  updatedAt: timestamp
  updatedBy: string
  deletedAt: timestamp?
  deletedBy: string?
  isDeleted: boolean
}
```

### 3.2 分享与展示字段

```text
ShareFields {
  shareToken: string?
  visibility: "private" | "link" | "wall"
  sharedAt: timestamp?
}
```

---

## 4. 错误处理

1. 所有错误统一返回：`code`、`message`、`requestId`
2. ZeroClaw 网关不可用时返回明确错误，不使用模拟回复
3. 参数校验失败返回字段级错误明细

---

## 5. 版本说明

本版仅保留学生侧接口集合；后续新增接口需保持单一用户形态与轻量闭环原则。

