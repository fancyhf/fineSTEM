{
  "architecture": {
    "type": "单页面应用（SPA）",
    "components": [
      {
        "name": "欢迎页面",
        "description": "显示项目标题、简介和「开始答题」按钮"
      },
      {
        "name": "答题页面",
        "description": "显示题目、选项、对错反馈和解析"
      },
      {
        "name": "结果页面",
        "description": "显示总分、每题对错状态和鼓励评语"
      }
    ],
    "data_flow": "页面加载 → 题库JS数组 → 随机打乱 → 用户点击选项 → JS判断对错 → 显示反馈+解析 → 下一题 → 所有题完成后显示结果"
  },
  "ui": {
    "style": "卡片式设计，渐变色背景，圆角卡片",
    "color_scheme": {
      "primary": "#667eea（蓝色渐变）",
      "success": "#28a745（绿色）",
      "error": "#dc3545（红色）",
      "background": "线性渐变（#667eea → #764ba2）"
    },
    "layout": "居中卡片布局，最大宽度600px，响应式适配"
  },
  "acceptance_cases": [
    {
      "id": "AC-01",
      "description": "页面加载后显示第一道随机题目，包含4个选项",
      "expected": "题目文本和4个选项按钮正确渲染"
    },
    {
      "id": "AC-02",
      "description": "点击正确选项，选项变绿色，显示解析",
      "expected": "正确选项高亮为绿色，解析文本出现"
    },
    {
      "id": "AC-03",
      "description": "点击错误选项，选项变红色，正确选项变绿色，显示解析",
      "expected": "错误选项红色高亮，正确选项绿色高亮，解析文本出现"
    },
    {
      "id": "AC-04",
      "description": "答完所有题后显示总分（格式：X/6）和评语",
      "expected": "结果页面正确显示得分和评语"
    },
    {
      "id": "AC-05",
      "description": "点击「再玩一次」按钮，题目重新随机打乱",
      "expected": "新一轮题目顺序与上一轮不同（大概率）"
    }
  ]
}