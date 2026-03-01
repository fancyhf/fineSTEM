# Web 题库（Next.js）（20题）

每题字段：title | 难度 | 成功标准（可测） | 典型输入/输出 | 风险&fallback

1) 待办清单 ToDo（带分类） | beginner | 能新增/完成/筛选3类 | 输入：文本；输出：列表 | 风险：状态混乱→fallback：只做新增+完成
2) 小测验 Quiz（10题） | beginner | 得分正确、能重开 | 输入：选项；输出：分数 | 风险：题库太大→fallback：先3题
3) 记账小本本 | beginner | 可新增记录、显示总额 | 输入：金额/类别 | 风险：表单校验→fallback：只校验非空
4) 单词卡 Flashcards | beginner | 能翻卡/标记已会 | 输入：单词对 | 风险：数据来源→fallback：内置10对
5) 心情打卡 Mood Tracker | beginner | 每天1条记录、能查看列表 | 输入：心情+备注 | 风险：日期处理→fallback：只用当天字符串
6) 图片画廊 Gallery | beginner | 能上传/展示/删除 | 输入：图片 | 风险：文件处理→fallback：用示例URL列表
7) 天气展示（Mock） | beginner | 输入城市→显示温度 | 输入：城市 | 风险：API不稳定→fallback：mock数据
8) 学习计时器 Pomodoro | beginner | 25/5倒计时、提醒 | 输入：开始/暂停 | 风险：计时bug→fallback：只做倒计时
9) 简易投票 Voting | beginner | 创建选项→投票→显示结果 | 输入：选项 | 风险：统计错→fallback：只显示票数
10) 课程资料小站 | beginner | 三个页面：主页/列表/详情 | 输入：静态数据 | 风险：路由复杂→fallback：只做列表+详情
11) 书单/片单收藏 | beginner | 收藏/取消收藏 | 输入：标题 | 风险：去重→fallback：不做去重
12) 简易聊天室（本地） | intermediate | 同页发送/展示消息 | 输入：文本 | 风险：实时→fallback：仅本地列表
13) 任务看板（3列） | intermediate | 至少能移动列 | 输入：卡片 | 风险：拖拽复杂→fallback：按钮移动
14) 学习进度条 | intermediate | 每项完成→进度更新 | 输入：勾选 | 风险：计算错误→fallback：直接统计完成数
15) 词典查询（Mock） | intermediate | 搜索词→显示释义 | 输入：词 | 风险：数据大→fallback：小词典10条
16) 简易博客编辑器 | intermediate | 新增文章→列表→详情 | 输入：标题/正文 | 风险：富文本→fallback：纯文本
17) 电影推荐器（规则版） | intermediate | 选偏好→输出推荐 | 输入：选项 | 风险：推荐逻辑空→fallback：规则表
18) 习惯打卡 + 连续天数 | intermediate | 连续天数正确 | 输入：打卡 | 风险：日期计算→fallback：只记录打卡次数
19) 小游戏：猜数字 | beginner | 反馈高/低、次数统计 | 输入：数字 | 风险：无
20) 小游戏：反应速度测试 | intermediate | 计时准确、能排名(本地) | 输入：点击 | 风险：排序→fallback：只显示本次
