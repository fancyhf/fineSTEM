# LLM API Key 统一管理说明（部署 Agent 必读）

> 版本：2026-08-23 | 适用：fineSTEM 腾讯云香港部署（wostemstudio.site）
> 背景：仓库已完成 key 治理重构，全项目 LLM key 只允许存在于下述两个位置。
> 部署时严格遵守本约定，任何"顺手把 key 写到别处"的操作都会破坏统一管理。

---

## 一、总规则：key 只分两层，每层只有一个入口

| 层 | 用途 | 唯一设置点 |
|---|---|---|
| 层1 后端直连 | GLM-4V 截图识别、CogView 封面图生成、DeepSeek 直连回退链路 | 服务器 `apps/backend/.env` |
| 层2 聊天主链路 | 前端 WebSocket → ZeroClaw daemon 的对话模型调用 | ZeroClaw `config.toml`（keyring 加密） |

除这两处外的任何位置**都不允许出现模型 key**：根目录 `.env`、前端任何 `.env*`、
docker-compose、nginx 配置、systemd unit 正文、脚本硬编码——一律不放。

---

## 二、层1：后端直连 key（服务器操作）

服务器路径按部署模板：`/opt/finestem/app/apps/backend/.env`，只需两个规范变量：

```env
# 智谱 GLM：GLM-4V 截图识别 + CogView 封面图 + GLM 直连对话
GLM_API_KEY=<用户提供的新智谱key>

# DeepSeek：直连对话回退链路
DEEPSEEK_API_KEY=sk-你的deepseek-key
```

注意：
- 旧命名 `glm_key` / `deepseek_key` 仍被 `app/core/config.py` 自动映射（兼容），
  但服务器上**只用规范命名**，不要新旧混写。
- 本地开发机 `apps/backend/.env` 里现有的 GLM key 已实测失效（智谱 401），
  用户会把新生成的 key 提供给部署流程，填入 `GLM_API_KEY=`。
- systemd 启动后端时用 `EnvironmentFile=/opt/finestem/app/apps/backend/.env`
  引用，不要把 key 写进 unit 正文。

### 验证命令（部署完必跑）

```bash
cd /opt/finestem/app/apps/backend
python3 scripts/check_llm_keys.py          # 只查配置，不发请求
python3 scripts/check_llm_keys.py --live   # 真实调用 GLM / DeepSeek 各一次
```

预期输出：`[OK] GLM 调用成功` 且 `[OK] DeepSeek 调用成功`，退出码 0。
GLM 显示 401 = key 没换新的或粘错；显示未配置 = .env 没就位。

---

## 三、层2：ZeroClaw daemon 的聊天模型 key

聊天主链路（前端 `useStreamingChat.ts` 直连 `wss://<域名>/zeroclaw/ws` → 服务器本机
daemon 42617）的模型 key 存在 ZeroClaw 的 config.toml，经 keyring 加密，**不放 .env**：

```bash
# 在服务器上、以运行 zeroclaw 的用户执行
zeroclaw config set providers.models.deepseek.default.api_key <deepseek-key>
zeroclaw config set providers.models.qwen.default.api_key <dashscope-key>

# 如需启用 GLM 作为 fallback（本地 config.toml 中该段当前被注释禁用）：
zeroclaw config set providers.models.glm.default.api_key <glm-key>
# 并取消 config.toml 中 [providers.models.glm.default] 三行注释
```

迁移参考：本地 H 盘 daemon 的 config.toml 里 deepseek/qwen 的 key 是 `enc2:` 加密串，
**不可直接拷贝**，在服务器上用上面的命令重新写入明文 key 即可。

---

## 四、前端：没有任何 LLM key

`apps/frontend/.env.production` 只含 API 地址和应用信息。其中：
- `VITE_ZC_TOKEN` 是 ZeroClaw **配对 token**（`zc_` 开头），由服务器 daemon 的
  `POST /pair` 派发，不是模型 key；在服务器配对后填入。
- 严禁把 `GLM_API_KEY` / `DEEPSEEK_API_KEY` 写进任何 `VITE_` 变量——
  Vite 变量会被打包进前端静态文件，等于公开发 key。

---

## 五、禁令与安全清单

1. `deploysettings/敏感/` 目录的文档里含**历史明文 key**（旧 DeepSeek `sk-41c2...`
   等），仅供排查参考，**禁止**把它们配置到服务器。
2. git 历史中泄露过 SiliconFlow key（`sk-mqyh...`，见 debug_siliconflow.py 旧版本
   及 projects/ 下用户 demo）——如该 key 仍有效，提醒用户到平台轮换，部署配置不用它。
3. 服务器上的 `.env` 权限收窄：`chmod 600`，属主为运行后端的用户。
4. 部署完成后自查一遍 key 没有散落：

```bash
# 服务器代码目录下执行，预期只命中 apps/backend/.env 和加密的 config.toml
grep -rn -E "sk-[a-zA-Z0-9]{20,}|[0-9a-f]{32}\.[A-Za-z0-9]{16}" /opt/finestem/app --include="*.env*" --include="*.toml" --include="*.py" | grep -v "enc2:"
```

---

## 六、相关文件索引（改动来源，2026-08-23 重构）

| 文件 | 说明 |
|---|---|
| `apps/backend/app/core/config.py` | 规范字段 `GLM_API_KEY`/`DEEPSEEK_API_KEY`，旧名自动映射，`extra="ignore"` |
| `apps/backend/.env` / `.env.example` | key 唯一设置点（含方舟/百炼备用存档区，未接线） |
| `apps/backend/scripts/check_llm_keys.py` | key 自检脚本（`--live` 真实调用） |
| `apps/backend/scripts/_zc_token.py` | 测试脚本公共 token 读取（`ZC_WS_TOKEN` 环境变量 → 前端 .env.development） |
| `deploysettings/server-deploy-env-template.env` | 部署模板，第四节已按本约定改写 |
