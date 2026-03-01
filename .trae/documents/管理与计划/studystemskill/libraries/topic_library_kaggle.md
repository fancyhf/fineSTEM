# Kaggle/建模题库（20题）

1) Titanic 生存预测 | beginner | baseline可提交submission.csv；解释关键特征 | 风险：特征工程难→fallback：缺失值+one-hot
2) House Prices 回归 | beginner | RMSE 优于 baseline | 风险：清洗→fallback：只用数值特征
3) 垃圾邮件分类（小数据） | intermediate | F1 提升，解释关键词 | 风险：文本处理→fallback：TF-IDF+线性模型
4) 电影评分预测 | intermediate | RMSE 改进 | 风险：稀疏→fallback：简单回归
5) 学生成绩预测 | beginner | MAE 可接受+解释特征 | 风险：缺失→fallback：简单填充
6) 鸢尾花分类 | beginner | 准确率>0.9 | 风险：过简单→fallback：做可视化报告
7) 信用风险二分类 | intermediate | AUC 改进 | 风险：不平衡→fallback：class_weight
8) 客户流失预测 | intermediate | 召回率达标 | 风险：阈值→fallback：固定0.5
9) 手写数字（小版） | intermediate | baseline可跑 | 风险：慢→fallback：采样子集
10) 房屋类型多类分类 | beginner | confusion matrix解释错误 | 风险：多类→fallback：减少类别
11) 交通流量预测（简化） | intermediate | 滑窗回归 | 风险：复杂→fallback：滞后1–3
12) 物品价格区间分类 | beginner | 准确率+特征重要性 | 风险：特征多→fallback：只选前10
13) 评论情感分析（小数据） | intermediate | F1 改进+示例解释 | 风险：清洗→fallback：最少清洗
14) 医疗风险预测（合成数据） | intermediate | AUC 改进+伦理说明 | 风险：敏感→fallback：合成数据
15) 天气类型分类 | beginner | 准确率>baseline | 风险：噪声→fallback：标准化+树模型
16) 推荐系统（热门baseline） | intermediate | Top-N 命中率 | 风险：实现复杂→fallback：热门推荐
17) 异常检测（简单） | intermediate | 标记异常点+可视化 | 风险：指标难→fallback：阈值+图
18) 图像分类（极简） | intermediate | 小模型可训练 | 风险：算力→fallback：小样本/特征法
19) 贷款审批预测 | intermediate | Precision/Recall取舍解释 | 风险：指标选择→fallback：AUC
20) 竞赛复盘报告 | beginner | 复现baseline + 3个改进点 | 风险：太空→fallback：强制模板
