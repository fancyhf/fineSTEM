{
  "project_id": "b686df08-6655-4edb-a3a5-955f3244abe1",
  "project_name": "奇幻选择之旅",
  "total_budget_hours": 4,
  "steps": [
    {
      "step": 1,
      "name": "故事数据 + 页面骨架",
      "estimated_hours": 2,
      "description": "写3个章节+2个结局的故事数据，搭建HTML页面结构和像素风CSS样式",
      "files": ["story_data.js", "index.html", "style.css"],
      "run": "1. 确定故事主题和角色\n2. 写3个故事章节文本 + 每个章节2个选项\n3. 写2个结局文本\n4. 搭建HTML结构（标题区、故事区、选项区、进度条、配图画布）\n5. 编写像素风CSS（配色、字体、布局）",
      "check": "浏览器打开index.html → 能看到标题、故事文字、两个选项按钮 → 点击不同按钮故事文字切换",
      "rollback": "保留HTML骨架和CSS样式，只调整文本内容",
      "story_data_schema": {
        "chapters": [
          {
            "id": "start",
            "title": "序章",
            "text": "故事正文...",
            "image": "scene_start",
            "options": [
              {"text": "选项A", "next": "chapter_a"},
              {"text": "选项B", "next": "chapter_b"}
            ]
          }
        ],
        "endings": [
          {
            "id": "ending_good",
            "title": "好结局",
            "text": "结局文本...",
            "is_ending": true
          }
        ]
      }
    },
    {
      "step": 2,
      "name": "故事引擎 + 视觉完善",
      "estimated_hours": 2,
      "description": "用JavaScript实现游戏引擎，Canvas画像素配图，进度条，结局判定",
      "files": ["script.js"],
      "run": "1. 写故事引擎（加载章节、处理选项跳转、结局判定）\n2. 用Canvas绘制像素风格配图\n3. 实现进度条动态更新\n4. 实现结局判定+重新开始按钮\n5. 加过渡动画和悬停效果",
      "check": "从头走到尾 → 3条分支都能走通 → 看到结局画面 → 进度条完整 → 能重开游戏",
      "rollback": "先只跑通一条主线分支，再逐步加分支"
    }
  ],
  "acceptance_tests": [
    {"given": "页面加载完成", "when": "显示序章", "then": "看到标题、故事文字、2个选项和配图"},
    {"given": "点击选项A", "when": "跳转到对应章节", "then": "故事更新、配图变化、进度条前进"},
    {"given": "点击选项B", "when": "跳转到不同分支", "then": "走向不同结局"},
    {"given": "到达结局", "when": "显示结局画面", "then": "有重新开始按钮可用"},
    {"given": "重新开始", "when": "点击重新开始", "then": "回到序章，进度条重置"}
  ],
  "created_at": "2026-06-30T14:00:00.000Z",
  "updated_at": "2026-06-30T14:00:00.000Z"
}
