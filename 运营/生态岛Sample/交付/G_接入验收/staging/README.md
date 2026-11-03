# Know 暂存包（staging/）——生态岛 Sample 待发布内容草稿

日期：2026-11-03｜出包：G 包第二段｜状态：**暂存包就绪（draft）≠ 线上已发布**

## 0. 这是什么、不是什么

- **是**：按当前生产 Know 的真实内容 schema（`apps/backend/app/schemas/know.py` + `apps/backend/app/services/know_content.py` 磁盘解析规则 + `content/know/` 现有样例）整理的**待发布草稿目录**，可直接审阅、可机器自检（`check-draft.py`）。
- **不是**：已发布内容。本目录不在 `content/know/` 下，生产服务扫描不到它；episode.json 的 `status` 显式写为 `"draft"`（loader 规则：缺省视为 published，**非 published 值不会出现在任何公开列表与详情**，know_content.py 第 149–150 行）。发布与否、何时发布，全部由统筹/用户另行安排。

## 1. 目录结构（镜像生产 content/know 布局）

```
staging/
├── README.md                ← 本文件
├── check-draft.py           ← 自检脚本（python -I staging/check-draft.py，2026-11-03 实跑 16/16 PASS）
└── draft/
    └── series/
        └── eco-island/      ← 新系列（与生产 7 个现有系列 slug 无冲突，实查核对）
            ├── series.json
            └── ep01/
                ├── episode.json
                ├── interactive/index.html   ← = B 包 reference/eco-island.html（逐字节复制，未改动）
                └── docs/
                    ├── 01-三个数字谁影响谁.md   ← C 包 knowledge/01（复制，未改动）
                    ├── 02-超载与承载力.md       ← C 包 knowledge/02（复制，未改动）
                    ├── 03-最短板.md             ← C 包 knowledge/03（复制，未改动）
                    ├── 04-模型的边界.md         ← C 包 knowledge/04（复制，未改动）
                    ├── 复刻指南.md              ← C 包 replicate-guide.md（复制，未改动）
                    └── 家长博客.md              ← E 包 parent-blog.md（复制，未改动）
```

（`draft/` 未含 `index.json`：站点级 index.json 只控制站点信息与 featured 提名；系列列表由服务扫描 `series/*` 自动生成，**挂接本系列无需改生产 index.json**。featured 提名可选，属发布时统筹决定项。）

## 2. 字段逐项来源（不猜字段、不新建字段，全部对照现有样例）

schema 依据：`know.py`（pydantic 响应模型）+ `know_content.py`（磁盘→响应的解析）+ 现有样例 `content/know/series/recursive-beauty/ep01/episode.json`（唯一带 interactive 的样例）与 `family-english/ep01/episode.json`。**磁盘字段与响应字段不同名处已按 loader 实际读法对齐**：磁盘用 `interactive.path`/`docs.path`（loader 拼成 `/content/...` URL），响应才是 `url`。

| 字段 | 本包取值 | 来源/理由 |
|---|---|---|
| series.slug | `eco-island` | 00 总策划项目 ID：eco-island；与生产 7 系列 slug 实查无冲突 |
| series.brand | `finestem` | 枚举 jiwa\|finestem；本 sample 是 fineSTEM 作品 |
| series.audience | `family` | 枚举 family\|parent\|child；少年+家长双受众 |
| series.theme_color | `#2E7D4F` | 自选绿色系（现有样例各自带色值，非新增字段） |
| episode.slug / episode_no | `ep01` / 1 | 样例惯例（ep 目录名与 slug 一致） |
| episode.title / summary / description_md | 自拟 | 全部口径出自 A model-spec §9 可照抄句 + A test-cases 实测锚点；描述中的【待统筹拍板】标记见 §3 |
| episode.audience | `family` | 同系列 |
| episode.tags | 生态/建模/STEM/亲子 | 自由字符串列表（现有样例同类） |
| **episode.status** | **`"draft"`** | 关键：loader 对缺省值按 published 处理，draft 必须显式写非 published 值 |
| episode.published_at | `null` | 发布日期不存在，不虚构（公共约定 §3） |
| episode.cover | `null` | F 包两版封面是视频平台物料；Know 端 episode 封面未制作，**不占位** |
| episode.default_tab | `null` | 无视频时默认落到 interactive tab |
| resources.interactive | `interactive/index.html`，ratio 16/9 | = B 包 reference（线上项目 04f835ac 现行版同源，G-E002 证实与 A 冻结模型逐字一致）；本地零外部依赖（已核查无 http/外链/localStorage），与 Know 前端 iframe 沙箱（`allow-scripts`）兼容（源码可见：apps/know/src/components/ResourceStage.tsx:62-66） |
| resources.videos | **`[]`（空）** | F 包两支视频均为**本地文件、未发布、无外链**；schema 的 videos 需要 `embed_url`（B 站嵌入），没有真实外链就不填占位地址（任务书第二段第 5 条）。发布待办见 §4 |
| resources.docs | 6 条，全部相对路径且文件已随包复制 | C 四章知识+复刻指南（少年侧）、E 博客（家长侧）；loader 规则：path 相对 episode 目录解析 |
| resources.projects | 1 条：`https://wostemstudio.top/research/projects/04f835ac-e922-4bde-ad11-8079b74ad3f4` | 线上项目 04f835ac 地址——**实际存在且已验证**（2026-11-02 生产站实测，范本 README §0；G 包第一段整理）。note 中如实标注：当前私有、需登录、未上灵感墙，公开方式待拍板 |

## 3. 拍板项在 draft 中的占位方式

JSON 无注释，且本包不新建字段，故拍板项以**正文中可见的【待统筹拍板：…】标记**呈现（审阅者一眼可见、发布前必须处理）：

| 占位位置 | 拍板项 | 影响面 |
|---|---|---|
| episode.json `description_md` 模型边界段 | 灭绝叙事①维持②弱化③调参（E 包 HANDOFF §7 三选） | 本段 + C 知识 02/04 + D 模板 06 示例 + F 少年片镜 3 + E 博客/视频（全局联动） |
| episode.json `description_md` 适合谁段 | 年龄段：12–15 岁（现行口径）vs 三年级 | 本段 + C/E/D 文案口径 |
| resources.projects[0].note | 发布入口公开方式（灵感墙/直链/公开项目） | 本条 + E 博客文末占位 + 少年脚本镜 6 |

`summary`/`description_md` 中所有数字（第 9 步、第 34 步、20.8/4/100）均为 A test-cases TC09 实测锚点，与六包核对一致（见 integration-report.md §2）。

## 4. 发布待办（发布=另按用户安排；本包不执行、也不预填）

1. **视频外链**：F 包两支视频（少年测试片 3:18、家长排片样片 2:06）均为本地文件：
   - `交付/F_媒体制作/少年讲解视频/生态岛-少年操作讲解-测试片-v1.mp4`（**测试片**：镜 6 为存档截图代过，待真人补录后才可称成片）
   - `交付/F_媒体制作/家长短视频/生态岛-家长口播-排片样片-v1.mp4`（**排片样片，非成片**：真人镜头为占位卡；TTS 版实测 126.3s 超 120s 上限，不可直接发布）
   - 两者**均未达到可发布成片标准**；即使成片后，videos[] 需要 B 站等外链 embed_url——上传与链接由统筹在发布时提供，届时回填 episode.json。
2. **配音音色拍板**（F HANDOFF §6：少年=小雅声 TTS 待确认、家长=芳姐声 TTS 小样 vs 真人配音二选一）。
3. **镜 6 平台操作补录 + 家长真人出镜补录**（F 逐镜执行卡已备步骤；镜 6 需统筹提供录制账号，不动线上项目 04f835ac）。
4. **封面**：Know 端 episode cover 未制作（F 两版为视频平台封面）；发布时确定。
5. **三处【待统筹拍板】正文标记**（§3）处理后移除标记。
6. **发布动作本身**：把 `draft/series/eco-island` 复制到生产 `content/know/series/`、status 改 published、回填 videos/cover/published_at——全部由统筹/用户安排执行（可先在测试环境按 `check-draft.py` 复检）。生产 `content/know/index.json` 的 featured 提名可选。

## 5. 自检方法

```
python -I staging/check-draft.py
```

脚本镜像 `know_content.py` 的磁盘解析规则（status 过滤、path/url 必填、文件存在性、slug 冲突），2026-11-03 实跑：**16 项全 PASS，0 FAIL，0 WARN**。JSON 均通过 stdlib json 严格解析。
