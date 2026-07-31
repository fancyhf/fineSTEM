# Git Stash@{0} 完整 Review 报告

**Review 日期**: 2026-07-31  
**Stash 标识**: `stash@{0}: WIP on main: 6832fcc fix: update Create page`  
**创建时间**: 2026-06-18（距今 43 天）  
**改动规模**: 8 个文件，+330 行 / -74 行

---

## 一、逐文件审查结果

### 1. `apps/frontend/src/pages/Login.tsx` — ✅ 已在当前代码中应用

| 项目 | 说明 |
|------|------|
| Stash 改动 | `navigate('/dashboard')` → `navigate('/')` |
| 当前代码 | 第 23 行已是 `navigate('/')` |
| 结论 | **无需操作，已合并** |

### 2. `apps/frontend/src/pages/Register.tsx` — ✅ 已在当前代码中应用

| 项目 | 说明 |
|------|------|
| Stash 改动 | `navigate('/dashboard')` → `navigate('/')` |
| 当前代码 | 第 36 行已是 `navigate('/')` |
| 结论 | **无需操作，已合并** |

### 3. `apps/backend/app/api/achievement_cards.py` — ✅ 已在当前代码中应用

| 项目 | 说明 |
|------|------|
| Stash 改动 | 新增 `import uuid`，`id=""` → `id=str(uuid.uuid4())` |
| 当前代码 | 第 10 行已有 `import uuid`，第 219 行已有 `id=str(uuid.uuid4())` |
| 结论 | **无需操作，已合并** |

### 4. `apps/backend/runtime/agent_metrics.json` — 🗑️ 应丢弃

| 项目 | 说明 |
|------|------|
| Stash 改动 | `total_requests: 81→85`，`success_requests: 81→85`，latency 数组追加 4 个值 |
| .gitignore | 第 60 行 `apps/backend/runtime/` 已覆盖此文件 |
| 结论 | **直接丢弃，不应进入版本控制** |

> 该文件是运行时状态，`.gitignore` 已排除整个 `runtime/` 目录。stash 中包含它说明当时可能是 `git add -f` 强制添加或 .gitignore 规则尚未添加。无论如何，此改动无意义。

### 5. `apps/frontend/src/components/CodeEditor.tsx` — ⚠️ 未应用，可 cherry-pick（需微调）

| 项目 | 说明 |
|------|------|
| Stash 改动 | `<div className="h-full w-full">` → `<div className="h-full w-full min-h-0">` |
| 当前代码 | 第 64 行：`<div className="h-full w-full" data-testid="code-editor">` |
| 冲突风险 | 低。当前代码新增了 `data-testid="code-editor"` 属性，直接 apply 会丢失该属性 |
| 结论 | **可手动 cherry-pick**，改为 `className="h-full w-full min-h-0"` 并保留 `data-testid` |

**建议操作**:
```tsx
// 当前
<div className="h-full w-full" data-testid="code-editor">
// 改为
<div className="h-full w-full min-h-0" data-testid="code-editor">
```

**`min-h-0` 的作用**: 在 flexbox/grid 布局中，子元素默认 `min-height: auto` 会阻止收缩。添加 `min-h-0`（`min-height: 0`）允许编辑器在父容器中正确收缩，解决 Monaco Editor 高度溢出问题。

### 6. `apps/frontend/src/services/api.ts` — ⚠️ 部分已应用，缺失网络错误 catch

| 项目 | 说明 |
|------|------|
| Stash 改动 | 1) 解析 `detail` 字段转为 `message`；2) 添加 `.catch()` 网络错误处理 |
| 当前代码 | 第 226-236 行已有 detail→message 转换逻辑（实现更完善，显式提取 `errorDetail`） |
| 缺失部分 | **网络错误 `.catch()` 不在当前代码中** |
| 结论 | **detail 处理已合并且更优；网络 catch 可单独提取应用** |

**当前代码**（第 226-236 行）:
```typescript
}).then(async (res) => {
  const data = await res.json() as ApiResponse<AuthResponse>;
  const errorDetail = (data as ApiResponse<AuthResponse> & { detail?: string }).detail;
  if (!res.ok && !data.message && errorDetail) {
    data.message = errorDetail;
  } else if (!res.ok && !data.message) {
    data.message = `登录失败 (${res.status})`;
  }
  return data;
});
```

**Stash 额外提供**:
```typescript
.catch((err) => {
  console.error('[authApi.login] 请求失败:', err);
  throw new Error('网络连接失败，请检查后端服务是否启动');
});
```

**建议**: 当前代码在网络断开时 `res.json()` 会直接抛异常，导致用户看到不可读的错误。建议添加 `.catch()` 处理。

### 7. `apps/frontend/src/pages/Research.tsx` — ⚠️ 未应用，可 cherry-pick

| 项目 | 说明 |
|------|------|
| Stash 改动 | 在 `ProjectList` 中添加 `validItems = items.filter(item => item.id && item.id.length > 0)` |
| 当前代码 | 第 200-217 行的 `ProjectList` 直接使用 `items`，无空 ID 过滤 |
| 冲突风险 | 低。函数签名已变更（新增 `onRename`, `onDelete` 参数），但过滤逻辑可独立插入 |
| 结论 | **可 cherry-pick**，但需确认空 ID 项目是否仍可能出现 |

**当前代码**:
```tsx
function ProjectList({ items, completed, onRename, onDelete }: { ... }) {
  if (items.length === 0) {
    return <div className="text-sm text-gray-500">暂无项目</div>;
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ProjectCard key={item.id} ... />
      ))}
    </div>
  );
}
```

**建议**: 如果 `achievement_cards.py` 的 fork UUID 修复已应用，空 ID 项目理论上不再出现。但作为防御性编程，添加过滤仍有价值——特别是避免 `key={item.id}` 为空字符串导致 React key 冲突。

### 8. `apps/frontend/src/pages/Create.tsx` — ❌ 已被当前代码完全取代，不可 apply

这是 stash 中最大的改动（+370 行），但当前代码已通过不同且更完善的实现覆盖了所有功能点：

| Stash 功能点 | 当前代码状态 | 说明 |
|-------------|-------------|------|
| `_rawContent` 字段（保留原始 XML 内容） | ❌ 不存在 | 当前代码采用不同方案：直接从 `workspace.chat_messages` 原始数组中读取最后一条消息的 `content`（第 1187-1195 行），无需在 Message 对象中冗余存储 |
| `buildFallbackQuestionFromContext()` | ❌ 不存在 | 当前代码采用后端二次确认方案（`confirmAndShow`，第 1193 行），比纯前端 fallback 更可靠 |
| `sanitizeAssistantNarration` 增强 | ❌ 已被取代 | 当前版本（第 123-182 行）完全重写，采用逐行分析 + DSML 标签精确匹配，比 stash 的简单正则替换更健壮，不会误杀 AI 教学代码 |
| `receivedContentUpdate` 逻辑 | ✅ 已存在（第 2550 行） | 当前代码已包含此逻辑 |
| `editorWidth` / `isResizing` / `handleResizeStart` | ✅ 已存在（第 918-2041 行） | 当前代码已包含，且增加了 `localStorage` 持久化（stash 中没有） |
| 编辑器面板可拖拽分割线 | ✅ 已存在（第 3822 行） | 当前代码已包含 |
| 空消息过滤 | ✅ 已存在（第 272 行） | 在 `normalizeWorkspaceMessages` 返回时 `.filter()` 过滤 |
| `pendingQuestion`（单数） | ❌ 架构已变 | 当前代码使用 `pendingQuestions`（复数数组，第 930 行），支持一次展示多张卡片。stash 的单数 API 完全不兼容 |
| 编辑器布局重构 | ✅ 已存在（不同实现） | 当前使用 CSS Grid `gridTemplateRows: 'auto 1fr'`（第 3831 行），比 stash 的 flex 方案更稳定 |

**关键冲突点**:
- `pendingQuestion`（单数）vs `pendingQuestions`（数组）— 所有引用此状态的代码都不兼容
- `sanitizeAssistantNarration` — 直接 apply 会覆盖当前更完善的实现，造成回归
- `normalizeWorkspaceMessages` — 当前版本无 `_rawContent`，且已有 `.filter()` 防空消息

**结论**: **Create.tsx 的 stash 改动应整体废弃**。所有功能点已在当前代码中以更优方式实现。

---

## 二、总结矩阵

| 文件 | 改动状态 | 冲突风险 | 建议操作 |
|------|---------|---------|---------|
| Login.tsx | ✅ 已应用 | — | 无需操作 |
| Register.tsx | ✅ 已应用 | — | 无需操作 |
| achievement_cards.py | ✅ 已应用 | — | 无需操作 |
| agent_metrics.json | 🗑️ 应丢弃 | — | 丢弃，不应追踪 |
| CodeEditor.tsx | ⚠️ 未应用 | 低 | **手动 cherry-pick** `min-h-0` |
| api.ts | ⚠️ 部分应用 | 低 | **手动添加** `.catch()` 网络错误处理 |
| Research.tsx | ⚠️ 未应用 | 低 | **手动 cherry-pick** 空 ID 过滤（防御性） |
| Create.tsx | ❌ 已取代 | 极高（不可 apply） | **废弃**，当前代码已全面覆盖 |

---

## 三、推荐操作方案

### 方案 A：提取 3 个小修复后 drop stash（推荐）

1. **CodeEditor.tsx** — 添加 `min-h-0`
2. **api.ts** — 添加 `.catch()` 网络错误处理
3. **Research.tsx** — 添加空 ID 过滤（可选，防御性）
4. 执行 `git stash drop stash@{0}` 丢弃 stash

### 方案 B：仅提取 CodeEditor + api.ts 后 drop

如果认为 Research.tsx 的空 ID 过滤已不必要（UUID 修复已应用），则只提取 2 个修复。

### 方案 C：直接 drop stash

如果 CodeEditor `min-h-0` 和 api.ts `.catch()` 也不急需，可以直接丢弃整个 stash。

---

## 四、技术细节备注

### `min-h-0` 的原理
在 CSS flexbox 中，子元素的 `min-height` 默认为 `auto`，意味着不会缩小到内容尺寸以下。Monaco Editor 的 `height="100%"` 需要父容器允许收缩，`min-h-0`（`min-height: 0`）解除这一限制。这是一个常见的 flexbox 高度溢出修复。

### api.ts `.catch()` 的必要性
当前代码 `await res.json()` 在以下场景会抛异常：
- 后端服务未启动（`fetch` 直接 reject）
- 网络中断
- 返回非 JSON 内容（如 502 HTML 错误页）

没有 `.catch()` 时，异常会以 `TypeError: Failed to fetch` 等原始形式传播到 UI，用户体验差。添加 `.catch()` 可以返回友好的中文错误提示。

### Create.tsx 为什么不应 apply
当前 `sanitizeAssistantNarration`（第 123-182 行）的注释明确记录了 2026-07-22 的重构：移除了 stash 中那些"激进规则"（`cat/ls/find` 行清理、`import os` 行清理等），因为它们会误杀 AI 正常的教学代码示例。如果 apply stash，会重新引入这些已修复的问题。

---

**Review 完成。建议执行方案 A：提取 3 个小修复后丢弃 stash。**
