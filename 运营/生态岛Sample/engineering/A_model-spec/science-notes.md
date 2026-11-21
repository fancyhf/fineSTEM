# 科学笔记（science-notes）——生态岛 Sample 知识口径

- 日期：2026-11-03 ｜ 作者：A 包（科学与模型）｜ modelVersion: eco-island-v1（冻结，见 model-spec.md）
- 用途：给 C（学习引导）、E（家长内容）、G（验收）一份"哪些话能说、哪些话不能说"的依据清单。
- 所有网页来源均为 2026-11-03 当日实际访问（WebFetch/curl 读取正文后摘引）；未读正文的条目明确标注"未核对正文"，不作主张依据。

## 0. 三类标注体系（全文使用）

| 标注 | 含义 | 使用规则 |
|---|---|---|
| 【真实知识】 | 有当日核对过的来源支持的概念/结论 | 引用时保留来源与访问日期 |
| 【模型简化】 | 真实概念在教学模型中的具体简化方式 | 必须说"这是简化"，不说"这是事实" |
| 【教学设定】 | 数值与虚构情景设定，无科学来源 | 不得写成科学结论；孩子问"为什么是 0.8"时答"为了让第一局 10 步内能看到事件" |

## 1. 来源清单（访问日期均为 2026-11-03）

| # | 来源 | 访问方式与链接 | 对应主张 |
|---|---|---|---|
| S1 | OpenStax《Biology 2e》§45.3 Environmental Limits to Population Growth（免费开放教材，CC 许可） | https://openstax.org/books/biology-2e/pages/45-3-environmental-limits-to-population-growth | 指数增长的前提是资源无限；逻辑斯蒂增长与承载力 K；(K−N)/K 为负 → 种群下降；羊、海豹种群"超过 K 后回落，围绕 K 波动" |
| S2 | OpenStax《Biology 2e》§45.4 Population Dynamics and Regulation | https://openstax.org/books/biology-2e/pages/45-4-population-dynamics-and-regulation | 密度制约因素（竞争、捕食、寄生虫等）与密度无关因素（天气、灾害、污染）；"Usually, the denser a population is, the greater its mortality rate"；承载力会随环境事件改变 |
| S3 | OpenStax《Biology 2e》§45.6 Community Ecology | https://openstax.org/books/biology-2e/pages/45-6-community-ecology | 草食（herbivory）定义："the consumption of plants by insects and other animals"；捕食定义；"Resources are often limited within a habitat and multiple species may compete to obtain them" |
| S4 | OpenStax《Biology 2e》§46.1 Ecology of Ecosystems | https://openstax.org/books/biology-2e/pages/46-1-ecology-of-ecosystems | 降雨量等栖息地要素"determine which organisms can exist within a particular area"（哪些生物能在某地生存） |
| S5 | LibreTexts（Norco College《Principles of Ecology》）7.3.1 Energy in Ecosystems | https://bio.libretexts.org/Courses/Norco_College/Principles_of_Ecology/07%3A_Ecosystems/7.03%3A_Energy_Flow_through_Ecosystems/7.3.01%3A_Energy_in_Ecosystems | 限制营养盐=相对浓度最低者；"an increase in this nutrient will increase primary productivity, while a decrease in this nutrient will decrease primary productivity"；补足一个非限制因素不会带来增长（氮过量后别的元素成为新短板）——"最短板"逻辑 |
| S6 | UCAR Center for Science Education（美国大学大气研究联盟教育站）Climate Postcards / Earth's Changing Biomes | https://scied.ucar.edu/activity/climate-postcards ；https://scied.ucar.edu/learning-zone/earth-system/earths-changing-biomes | "A region's climate impacts the types of plants and animals that can live there"；植被类型定义生物群系 |
| S7 | South Dakota State University Extension（大学推广站）The Lasting Effects of Overgrazing on Rangeland Ecosystems | https://extension.sdstate.edu/lasting-effects-overgrazing-rangeland-ecosystems | 过度放牧定义："excessive and continuous grazing, which causes damage to grass or rangelands"；在植物从上次啃食恢复前再次啃食；来年牧草产量显著下降 |
| S8 | Encyclopaedia Britannica: Extinction (biology) | https://www.britannica.com/science/extinction-biology | 灭绝="the dying out or extermination of a species"（物种层面）；生境丧失是当前灭绝的主因；引入入侵物种是人为成因之一 |
| S9 | Klein, D.R. (1968) "The Introduction, Increase, and Crash of Reindeer on St. Matthew Island", The Journal of Wildlife Management 32(2): 350；及 Klein (1987) "Vegetation Recovery Patterns following Overgrazing by Reindeer on St. Matthew Island", Journal of Range Management 40(4): 336 | 题录经 CrossRef API 核实（curl，2026-11-03）：https://doi.org/10.2307/3798981 、https://doi.org/10.2307/3898732 ；叙事细节经 Wired/Arctic Portal 转述页核对：https://icr.arcticportal.org/component/content/article/55-reindeer-blog-feed/1125-mysterious-collapse-of-reindeer-blamed-on-freak-storms-wired | 经典"超载→崩溃"案例：1944 年 29 头驯鹿登岛（无捕食者），1963 年约 6000 头，1966 年仅剩 42 头且无繁殖能力，随后消亡。原研究归因于地衣（冬季食物）被啃竭；后续气象研究补充 1964 年极端冬季风暴的作用——成因解释有学术讨论空间 |
| — | Khan Academy "Exponential and logistic growth" | https://www.khanacademy.org/science/biology/ecology/population-growth-and-regulation/a/exponential-logistic-growth | **未核对正文**（2026-11-03 两次尝试，页面为 JS 渲染，抓取工具拿不到正文）。仅确认入口存在。本文件不给它背书任何主张 |
| — | National Geographic Education "Carrying Capacity" | 尝试 https://education.nationalgeographic.org/resource/carrying-capacity（2026-11-03） | 404 未取到；未使用 |
| — | Oxford Reference "Liebig's law of the minimum" | 尝试（2026-11-03） | 403 拒绝；未使用。Liebig 式"最短板"思想改由 S5（LibreTexts 限制营养盐）承担 |

## 2. 主张总表（C/E/G 可直接引用的清单）

| 编号 | 主张 | 类别 | 依据 |
|---|---|---|---|
| C1 | 动物吃草是"草食关系"，属于物种间营养关系的教科书概念；本模型把它简化为"每动物每步吃掉 0.8 份草" | 真实知识（概念）+ 模型简化（数值） | S3；数值为教学设定 |
| C2 | 栖息地资源有限，生物会为资源竞争；种群密度越高，竞争与死亡率压力越大 | 真实知识 | S3、S2 |
| C3 | 资源有限时种群增长会放缓并趋向环境承载力 K；超过 K 会出现负增长（下降），真实种群可在 K 附近波动 | 真实知识 | S1 |
| C4 | "引入无捕食者岛屿 → 暴增 → 崩溃"有真实案例（圣马太岛驯鹿，1944–1966），且其成因在文献中有"啃食耗竭"与"极端风暴"两种互补解释 | 真实知识（案例本身）；成因归因开放 | S9 |
| C5 | 连续啃食、不给植物恢复时间会损害草场，导致之后多年产量下降——"吃掉的速度超过长回来的速度"是要避免的情形 | 真实知识 | S7 |
| C6 | 降水/水分是决定一个区域能长什么植物、长多少的关键环境因素之一；水分断供时植物生长停止 | 真实知识 | S4、S6；模型中 water=0 → 草不长即此概念的最简表达 |
| C7 | 生物生长受"最短板"限制：增加最缺的那个因素才有效，增加不缺的因素没有用（Liebig 式限制因子思想的教育版） | 真实知识 | S5 |
| C8 | 密度制约调节：动物越多，每步消耗的草与水越多，资源崩溃越快（模型中 0.8×动物数、0.3×动物数） | 真实知识（概念）+ 模型简化（数值） | S2；数值为教学设定 |
| C9 | "灭绝"在科学上是物种层面概念；模型里动物归零只是这一局/这座岛上的种群消失，草与水会恢复，动物还可能迁回来——不等于物种灭绝，也不等于生态失败 | 真实知识（概念区分）+ 模型行为 | S8 + model-spec §6.4/§8（TC04/TC08/TC09 实测） |
| C10 | 模型没有显式承载力 K 与平滑逻辑斯蒂曲线，用"草>50 加 2 / 草<20 减 3"的阈值规则近似"食物多来、食物少走" | 模型简化 | S1 为概念背景；阈值规则为教学设定 |
| C11 | 模型把岛当封闭系统（只有进食、饮水、迁入三种接触外界的通道；没有迁出后再去别处、没有捕食者、没有天气随机） | 虚构情景 + 教学设定 | 无来源；structural |
| C12 | 全部数值参数（0.8、0.3、+2/−3、80/50/20、+1/+3/+6、60 步、默认 60/20/50）均为教学设定，无科学来源 | 教学设定 | model-spec §7 |

## 3. 结论边界（任务书第 4 条的正面回答）

1. **"加水不一定更好"**——默认参数下成立，且有实测：小雨/中雨/大雨三档动物都在第 9 步归零、第 34 步回增（A-E001/A-E002），因为限制动物的不是水，而是草的生长速度上限（每步 +2）。概念依据是"最短板"（C7/S5）：补的不是短板，就不会改变结果。**边界**：如果水真降到 0（如初始动物 40 的情景，第 10 步水见底），干旱确实会雪上加霜（A-E002 S-D）——水重要，但"多"不等于"更好"。
2. **"动物归零不等于生态失败"**——模型实测：动物归零后草与水自行恢复，草过 50 动物还会迁回（TC04、TC08、TC09）。概念上，模型中的"归零"是局部种群消失，不是物种灭绝（C9/S8）。**边界**：不要说"所以现实中动物灭绝没关系"——现实灭绝是物种层面的、不可逆的（S8）。两句话要一起出现。
3. **"稳定/恢复/更好"必须先定义**——本项目的比较基准固定为：同一配置、同一 60 步窗口内的三条状态轨迹。跨配置比较只陈述具体差异（如"大雨档水位更高"），不说"大雨档更好"。
4. **长期走势只说实测过的**——目前唯一有 60 步完整实测的长期情景是默认参数与 A-E002 的六个预演情景；写成文的确定结论仅限这些。low 档长期、"食草系数可调"改造后的长期走势，B 实装复核前只以"问题/预期"形式出现。
5. **模拟步不是天**——一切"第 N 步"不换算成真实时间。
6. **指数不是数量**——0–100 是教学指数；不写"20 只兔子""50 毫米降雨"。

## 4. 术语表（给 C/E 的用词规范）

| 术语 | 建议用法 |
|---|---|
| 承载力（carrying capacity, K） | 可用；12–15 岁可直接给术语，解释为"环境养得起的最大种群规模"（S1） |
| 超载崩溃（overshoot & crash / die-off） | 可用；配圣马太岛案例（C4/S9），注意成因归因要留讨论空间 |
| 过度啃食（overgrazing/overbrowsing） | 可用；强调"连续啃食、不给恢复时间"（C5/S7） |
| 限制因子 / 最短板 | 可用；优先用"最短板"比喻（C7/S5） |
| 密度制约（density-dependent） | 建议在少年章节用"越挤越难过"先行，再给术语 |
| 迁入（immigration） | 描述模型"草>50 动物+2"时使用；明确这是教学设定（岛是开放的） |
| 教学指数 | 描述 0–100 数值时统一用此词，不用"数量/浓度" |

## 5. 与模型的对应关系速查

| 模型规则 | 背后的真实概念 | 简化掉的 |
|---|---|---|
| 有水才长草；草<80 长得快 | 水分限制植物生长（C6/S4/S6）；密植生长放缓 | 养分、光照、温度、季节 |
| 每动物吃 0.8 草/步 | 草食关系、密度制约（C1/C8/S3/S2） | 个体差异、食谱、捕食者 |
| 草>50 +2 / 草<20 −3 | 食物丰缺影响种群（C3/C10/S1） | 出生/死亡细分、平滑响应、时滞 |
| 动物喝水 0.3/步；档位补水 | 水循环与消耗（C6） | 蒸发、渗漏、存水容量差异 |
| 草>50 从 0 也 +2 | 种群迁入/再定殖（C9） | 迁出、扩散成本、建群失败概率 |
| 每步舍入、60 步上限、全确定性 | ——（工程与教学选择） | 随机天气、连续时间 |
