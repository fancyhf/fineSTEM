# 关键发现

- created_at: 2026-06-13 15:10:34.000

## 创造主链路

- `runtime_db.py` 仍把 `get_skill_state/create_skill_state/update_skill_state/advance_skill_state` 转发到 `memory_db`，这是状态源分裂的直接入口。
- `ProjectRepo` 已经具备 ORM 版 `skill_state` 增删改查与推进能力，因此核心修复不需要重建整套后端，只需要把运行时入口接回仓储层。
- `Create.tsx` 存在多处阶段硬编码：
  - 历史恢复时写死 `stage_07`
  - 项目创建后写死 `stage_07`
  - `project_created` 事件写死 `stage_01`
- `Create.tsx` 自动保存代码和聊天记录时对失败全部使用 `.catch(() => {})` 静默吞错，导致历史恢复失败长期不透明。
- `projects.py` 当前仍把代码与聊天塞进 `projects.initial_data`，但存取路径分散，缺少统一的工作台恢复接口。
- `agent.py` 已切换到 `stream_chat_with_events()`，前端 `useStreamingChat.ts` 也已支持 `stage_changed/project_created/question/content_update` 事件，说明“事件式工作流”基础已具备。

## 历史恢复

- `ProjectDetail.tsx` 和 `Create.tsx` 当前都依赖 `saveCode/getCode/saveChat/getChat` 组合恢复数据，没有“完整工作台恢复”接口。
- `Create.tsx` 在无历史代码时只打开编辑器，不清空状态，存在残留上一个项目代码的风险。

## 可直接落地的修复方向

- 把 `runtime_db.py` 的 `skill_state` 方法切回 `ProjectRepo`。
- 在 `ProjectRepo.update_project()` 中对 `initial_data` 做统一 JSON 序列化，避免复杂对象直接写入文本列。
- 新增 `/projects/{id}/workspace` 接口，一次性返回项目、进度、代码、聊天与工作区元数据。
- 让创造页和历史项目入口统一走 `workspace` 恢复，而不是各自拼接接口。
- 去掉 `Create.tsx` 中的阶段写死逻辑，统一以后端返回值更新状态。
