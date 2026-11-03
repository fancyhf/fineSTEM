# 代码地图（code-map）

适用：`reference/eco-island.html`（约 460 行，单文件）。其余派生版结构相同。

## 文件结构（四区）

| 区 | 位置线索 | 职责 |
|---|---|---|
| ① 配置区 | 搜 `① 配置区` | MODEL_VERSION / MAX_STEPS / 档位表 REPLENISH / buildConfig()（读滑杆）/ clamp100() |
| ② 模型区 | 搜 `function stepModel` | **唯一的计算规则**，不碰任何页面元素 |
| ③ 渲染区 | 搜 `③ 渲染区` | render()：只读状态，画小岛（草山色相/花朵/兔子/池塘/干旱徽章）和三张数值卡 |
| ④ 小岛日记 | 搜 `④ 小岛日记` | addDiary()（最多 20 条）+ narrate()（状态跨越→孩子话） |
| ⑤ 控制区 | 搜 `⑤ 控制区` | start/pause/reset/doStep + 事件绑定 |

## 模型规范摘要（完整规范以 A 包 model-spec.md 为准）

- 状态 `{step, grass, herbivores, water}`，指数 0–100；配置 `{modelVersion, initialState, environment.replenishLevel, maxSteps}`
- 每步顺序：①草生长（water>0：grass<80 时 +2，否则 +0.5；water=0 不长）②吃草 eaten=herbivores×0.8 ③动物（草>50 +2；<20 −3）④水（+档位 −herbivores×0.3）
- 取整：grass/water 两位小数，herbivores 取整；水分与动物 clamp 0–100；**草只有 0 下限、超过 100 不截断**（按 A 冻结规范 §6.1）
- 档位：low=1 / mid=3 / high=6（默认 mid）；maxSteps=60；**maxSteps 停机由界面层实现**（doStep/render 检查并暂停），模型层 step 会继续递增（按 A 冻结规范 §6.2，与旧 reference.html 的模型内停机行为不同）
- 确定性：无随机数，同输入永远同输出；`stepModel` 不修改旧状态（返回新对象）

## 孩子重点学习的 5 处代码（按教学价值排序）

1. **`function stepModel(previousState, config)` 的四步顺序**——整个"生态"就在这 20 行里；理解"顺序很重要"（先长后吃 vs 先吃后长结果不同）
2. **`newGrass = Math.max(0, newGrass - eaten)`**——学会用 max/min 做"不低于 0"的边界保护
3. **`if (newGrass > 50) …else if (newGrass < 20)…`**——阈值条件分支：一个数值决定种群涨落（联动现实：过度放牧）
4. **`narrate(prev, next)` 里 `prev.grass > 0 && next.grass === 0`**——状态"跨越检测"：怎么把数学变化翻译成人话（事件驱动思路）
5. **`timer = setInterval(doStep, speed)` 与 `clearInterval`**——为什么"速度只改间隔不改结果"：把计算和展示解耦

## 版本说明

- v3（=reference）：现行儿童版 UI；stepModel 与 AI 导师首版生成一致（已手算+实测双验证）
- starter：挖 5 处 TODO（档位表/草生长/吃草系数/池塘高度/灭绝警报），全部保留安全默认值，无语法错误
- variants/standard：`|| 3` → `?? 3` 是其唯一隐蔽改动，见 notes.md 的"实现陷阱"
