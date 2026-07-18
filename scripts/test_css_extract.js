// 测试 CSS 提取正则
const testContent = `
我仔细看出来了。用户界面里显示的"进度"、"已发现结局"等元素是页面中已有的硬编码HTML，而引擎的JS代码没有正确将数据渲染进去。问题在于 index.html 的DOM结构与 story_engine.js 不匹配，以及JS没有等到数据完全加载后再运行。

现在一次性修改所有4个文件，让它们完全对齐：

/* ====== 奇幻选择之旅 — 完整样式 ====== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  background: #0c0a1a;
  color: #e0d8f0;
  font-family: 'Segoe UI', 'PingFang SC', Roboto, 'Helvetica Neue', sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.game-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.title {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 10px;
}
`;

// 新的简化正则
const cssBlockPattern = /(?:\/\*[\s\S]{0,200}?\*\/\s*)?(?:\*|[\w#\.\-:\[\]]+)\s*\{[\s\S]{100,}?\}(?:\s*(?:[\w#\.\-:\[\]]+)\s*\{[\s\S]*?\})*/;
const cssMatch = testContent.match(cssBlockPattern);

if (cssMatch) {
  console.log('✅ 匹配成功！');
  console.log('匹配长度:', cssMatch[0].length);
  console.log('前200字符:', cssMatch[0].substring(0, 200));
  
  const cssCode = cssMatch[0].trim();
  const cssProps = (cssCode.match(/\b(margin|padding|background|color|font-size|display|border|position|width|height|flex|grid|opacity|transform|transition|animation|z-index|overflow|text-align|line-height|font-family|box-shadow|border-radius):/gi) || []);
  console.log('CSS属性数量:', cssProps.length);
  console.log('属性列表:', cssProps.slice(0, 10));
} else {
  console.log('❌ 匹配失败');
}
