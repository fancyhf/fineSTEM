# Know 频道发布指南（给 AI Agent）

> 对象：负责把课程 / 项目 / 节目内容发布到 Know 频道（"与孩子对话"）的 AI Agent。
> 线上：https://know.wostemstudio.top （境内镜像 show.zmengya.cn 自动跟随）。
> 依据：ADR-002（`.trae/documents/adr/ADR-002-publish-contracts.md`）+
> `deploy/Know子系统部署指南_v1.0.md`。本文是两者的**内容发布操作提炼**，冲突时以那两份为准。

---

## 1. 一句话模型

Know 是 **content-as-code**：一个节目 = `content/know/series/<系列>/<集>/` 目录 +
一个 `episode.json` 清单。**发布内容不需要写任何代码**——复制产物文件、填 JSON、
校验、commit push、服务器 git pull，即上线。后端按 *.json 文件指纹自动重扫，**无需重启**。

日常分工：内容在各工作空间（如 `G:\buddyspace\鸡娃先自鸡\`）生产，**负责人告知
Agent 源路径和 B 站 BV 号**，Agent 执行搬运入库（本 SOP）。

## 2. 铁律（违反 = 校验失败或部署事故）

1. **视频一律 B 站嵌入，不存视频文件**。`episode.json` 里只写 `embed_url`
   （`//player.bilibili.com/player.html?bvid=BVxxx&autoplay=0` 形态），仓库和服务器
   都不出现 mp4。校验脚本会拒绝自托管视频地址。
2. **一切部署所需进 git**（代码 + 内容 + 文档），服务器只从 GitHub 拿东西。
   注意：`content/know/` 内的**封面 jpg/png、字体、互动动画全部入库**——
   这与 `运营/` 目录"图片视频音频一律不提交"的规则**相反**，别搞混。
3. **`validate:content` 零错误才能发布**（见 §5）。警告可接受，错误不行。
4. **互动 web 产物原样复制，不改写**。手写 HTML 动画进 `interactive/` 目录即被
   iframe 托管，不要求改成任何框架组件。禁外部字体/CDN，公共字体已自托管在
   `content/know/assets/fonts/`。
5. JSON 里的 `slug` 必须与目录名一致；`status: published` 必须填 `published_at`
   （YYYY-MM-DD）；`audience` 只能是 `family` / `parent` / `child`。
6. 清单引用的文件（cover、interactive.path、docs[].path）必须真实存在，
   校验会逐一查。

## 3. 目录结构与两类发布物

```
content/know/
├── 内容发布指南_给Agent.md    ← 本文
├── index.json                 ← 频道名 + 首页主打位（featured）
├── assets/                    ← 公共资源（默认封面 SVG、自托管字体）
└── series/<系列slug>/
    ├── series.json            ← 系列清单（新系列才需要建）
    └── ep01/                  ← 一集一个目录（ep01、ep02…）
        ├── episode.json       ← 本集清单（发布的核心动作）
        ├── cover.jpg          ← 节目封面（必须有；可由 Agent 生成）
        ├── interactive/       ← 互动演示（手写 HTML 原样放入，入口 index.html）
        └── docs/              ← 文稿/脚本/指引（md）
```

**判断发布类型**：
- 往已有系列**加一集** → 只建 `epNN/` 目录 + `episode.json`，不动 series.json。
- **新系列** → 先建 `series/<slug>/series.json`，再建第一集。新系列默认只出现在
  频道首页"全部系列"，**归入哪个栏目需要改前端**（见 §7），属于契约②改动。

## 4. 清单字段参考

### series.json（系列级）

```json
{
  "slug": "family-english",          // 必填，= 目录名
  "title": "一家人一起学英语",        // 必填
  "subtitle": "爸妈不用先学会，家里就是泳池",
  "brand": "finestem",               // 必填，finestem | jiwa
  "description": "家长播客系列：……",
  "tags": ["英语启蒙", "家庭共学"],
  "audience": "parent",
  "theme_color": "#C9A24B",          // 系列主题色，缺省 #3E6B8C
  "docs": []                          // 系列级资料 [{title, path, format}]，path 相对系列目录
}
```

### episode.json（集级，发布核心）

完整可运行示例（摘自 `series/recursive-beauty/ep01/episode.json`）：

```json
{
  "slug": "ep01",                        // 必填，= 目录名
  "episode_no": 1,                       // 必填，正整数
  "title": "数学思维：花里藏数列",        // 必填
  "summary": "从 1 块积木到 21 层塔，孩子第一次“看见”递推。",   // 必填（列表卡片用）
  "description_md": "……支持 **Markdown**，详情页正文",           // 建议写：怎么用这集、适合年龄、要点
  "audience": "family",                  // 必填，family | parent | child
  "tags": ["数学启蒙", "递推"],
  "status": "published",                 // 缺省即 published；published 必须有 published_at
  "published_at": "2026-09-01",
  "cover": "cover.jpg",                  // 相对本集目录
  "default_tab": "parent-video",         // 详情页默认激活 tab：parent-video | interactive | child-video | 视频 id；null = 自动（家长播客优先）
  "announce": {},                        // 未上线槽位占位，见下
  "resources": {
    "interactive": {                     // 可选；有它详情页才有"互动演示"tab
      "title": "互动演示 · 搭积木",
      "path": "interactive/index.html",  // 相对本集目录
      "ratio": "16/9"                    // iframe 宽高比，缺省 16/9
    },
    "videos": [                          // 每条视频独立条目，换平台只改数据
      {
        "id": "parent-video",            // 固定槽位 id：parent-video / child-video；其余自定义
        "audience": "parent",            // parent→家长播客槽位；child→儿童视频槽位；null→通用视频排后面
        "title": "家长播客 · 数学思维：花里藏数列",
        "embed_url": "//player.bilibili.com/player.html?bvid=BV1294X6cE4m&autoplay=0",
        "page": "https://www.bilibili.com/video/BV1294X6cE4m"   // 可选，"去B站看"原链
      }
    ],
    "docs": [                            // 本集资料 [{title, path, format}]，path 相对本集目录
      { "title": "儿童视频脚本 · 第 1 集", "path": "docs/儿童视频脚本_第1集.md", "format": "md" }
    ],
    "projects": [                        // 关联项目外链（如主站灵感墙作品）
      { "title": "节目里的小程序 · 单词闯关助手",
        "url": "https://wostemstudio.top/explore/inspiration/…",
        "note": "孩子在 AI 辅助下做的背单词工具" }
    ]
  }
}
```

**详情页 tab 规则**（`apps/know/src/lib/resourceTabs.ts`）：固定槽位
家长播客 → 互动演示 → 儿童视频 → 其余通用视频；有资源才有 tab。

**视频未上线时**：不要编造 embed_url。在 `announce` 里占位，页面渲染禁用 tab +
提示文案，例如：

```json
"announce": { "child-video": "儿童视频剪辑中，本周上线" }
```

### index.json（频道级，通常不动）

`featured.{series, episode, note}` 控制首页"本期主打"。改它必须指向真实存在的
系列/集（校验会查）。有重磅新节目时可更新。

## 5. 发布 SOP（按序执行）

```bash
# ① 搬运（Windows Git Bash，源路径由负责人提供）
#    互动 web → interactive/（原样复制）；文档 → docs/；封面 → cover.jpg
cp -r "<源路径>/互动项目"  content/know/series/<系列>/<集>/interactive
cp -r "<源路径>/文档"      content/know/series/<系列>/<集>/docs

# ② 填 episode.json（新系列先建 series.json；字段见 §4）

# ③ 校验（零错误才继续；警告读一遍确认无碍）
cd apps/know && npm run validate:content
# 等价：node scripts/validate-content.mjs  （零依赖，可指定内容目录参数）

# ④ 入库推送（git 是服务器拿到内容的唯一途径）
git add content/know
git commit -m "content(know): <系列> 新增第 N 集 <标题>"
git push
```

## 6. 服务器同步与验收

服务器是香港腾讯云 43.128.8.131，扁平布局（`/opt/finestem/repo` 仅文件来源，
运行目录 `/opt/finestem/app`、内容 `/opt/finestem/content/know`、前端产物
`/opt/finestem/know/dist`）。**用户不手工操作服务器**——把下述步骤交给腾讯云
Agent 执行（完整 prompt 见 `deploy/腾讯Agent部署prompt.md`；命令细节见
`deploy/Know子系统部署指南_v1.0.md` §2.3）。按改动分层，只做需要的：

| 本次改动 | 服务器动作 | 重启后端 |
|---|---|---|
| 仅 `content/know` | repo `git pull --ff-only` → `cp -r repo/content/know/* /opt/finestem/content/know/` | **否**（自动重扫） |
| `apps/know`（前端） | git pull →（package.json 变了先 `npm install`）→ `npm run build` → dist 复制到 `/opt/finestem/know/dist` | 否 |
| `apps/backend` | git pull → 按 §0 对应关系复制文件到 `/opt/finestem/app` | **是** |

服务器同步后验收（内容-only）：

```bash
curl -s  https://know.wostemstudio.top/api/v1/know/home | grep success
curl -sI https://know.wostemstudio.top/content/series/<系列>/<集>/cover.jpg   # 200
# 浏览器打开 https://know.wostemstudio.top/ep/<系列>/<集> 核对（前端改动要 Ctrl+F5）
```

**境内镜像 show.zmengya.cn 无需任何操作**：它反代香港源站的 /api 与 /content，
内容发布自动跟随。（例外：`apps/know/src` 前端改动需按同步规则覆盖
`G:\mediaProjects\myMiddle\show\src` 并在该侧构建，见镜像部署 prompt。）

## 7. 何时超出本 SOP（升级为代码任务）

- **新系列要进某个栏目**：四栏目归属写死在 `apps/know/src/categories.ts`
  （podcast / kids / shengxue / stem）。改它 = 前端改动 = 契约②，需走前端构建 +
  服务器同步 + 镜像同步。kids 栏目是动态口径（含 interactive 或儿童视频的节目自动进），
  无需登记。
- **新栏目 / 改设计系统**：产品级改动，先与负责人确认，不是发布任务。

## 8. 常见坑

- **图片入库规则两套**：`content/know/` 内图片必须提交；`运营/` 内图片视频音频
  一律不提交。同一台机器两个规则并存，按目录区分。
- 服务器 `npm install` 会改动 `package-lock.json`，导致下次 `git pull` 被拒——
  部署后 `git checkout -- package-lock.json` 还原。
- 后端内容目录缺失时**静默返回空数据不报错**（服务器靠 `.env` 的
  `KNOW_CONTENT_DIR=/opt/finestem/content/know`）——"首页有壳没数据"先查这个。
- B 站播放器空白：确认 embed_url 带 `bvid=`；必要时补 `&page=1&high_quality=1`。
- `epNN` 目录用两位数字（ep01…ep10），`episode_no` 与序号保持一致。
- 封面可用 `assets/default-cover.svg` 兜底，但正式发布应有自己的 cover.jpg
  （列表卡片和分享海报都用它）。
