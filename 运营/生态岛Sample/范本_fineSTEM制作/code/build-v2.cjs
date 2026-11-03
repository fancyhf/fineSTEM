// 从 v1（AI 三段拼装版）生成 v2：按 AI 导师给出的修复方案落地 4 处 UI 修复
// 模型层 stepModel 不动（已手算验证）。运行：node build-v2.cjs
const fs = require("fs");
const path = require("path");
const dir = __dirname;
let t = fs.readFileSync(path.join(dir, "eco-island-ai-chat-v1.html"), "utf8");
const fixes = [];

// 修复1：init 里填充两个下拉框（原 select 是空的，档位功能不可用）
const a1 = "window.addEventListener('load', init);";
if (!t.includes(a1)) throw new Error("锚点1未找到");
const r1 = `
  // 初始化下拉框选项（修复：原本是空的，档位功能不可用）
  function populateSelects() {
    const speedSel = document.getElementById('speed-select');
    if (speedSel && speedSel.options.length === 0) {
      speedSel.innerHTML = '<option value="slow">慢（0.5 秒/步）</option><option value="medium" selected>中（0.2 秒/步）</option><option value="fast">快（0.05 秒/步）</option>';
    }
    const repSel = document.getElementById('replenish-select');
    if (repSel && repSel.options.length === 0) {
      repSel.innerHTML = '<option value="low">低（每步 +1）</option><option value="mid" selected>中（每步 +3）</option><option value="high">高（每步 +6）</option>';
    }
  }
  window.addEventListener('load', function () { populateSelects(); init(); });`;
t = t.replace(a1, r1);
fixes.push("1 下拉框选项填充");

// 修复2：updateUI 里绑定画面（草层透明度、水层高度随状态）
const a2 = "  // 清空并重新渲染动物点（CSS 圆点）";
if (!t.includes(a2)) throw new Error("锚点2未找到");
const r2 = `  // 画面与状态一致（修复：草层深浅、水层高度随状态更新）
  const grassLayerEl = document.getElementById('grass-layer');
  const waterBarEl = document.getElementById('water-bar');
  if (grassLayerEl) grassLayerEl.style.opacity = String(0.25 + 0.75 * (state.grass / 100));
  if (waterBarEl) waterBarEl.style.height = String(state.water * 0.3) + '%';

  // 清空并重新渲染动物点（CSS 圆点）`;
t = t.replace(a2, r2);
fixes.push("2 画面随状态更新");

// 修复3：动物点固定位置公式（去 Math.random）
const a3 = "dot.style.left = `${20 + Math.random() * 60}%`;";
if (!t.includes(a3)) throw new Error("锚点3a未找到");
t = t.replace(a3, "dot.style.left = (15 + ((i * 37) % 70)) + '%';");
const a4 = "dot.style.top = `${30 + Math.random() * 40}%`;";
if (!t.includes(a4)) throw new Error("锚点3b未找到");
t = t.replace(a4, "dot.style.top = (25 + ((i * 23) % 45)) + '%';");
fixes.push("3 动物点固定位置");

// 修复4：日志去时间戳
const a5 = "logLines.push(`[${new Date().toLocaleTimeString()}] ${text}`);";
if (!t.includes(a5)) throw new Error("锚点4未找到");
t = t.replace(a5, "logLines.push(text);");
fixes.push("4 日志去时间戳");

// 头部标注（作者/AI 贡献分开标明，符合公共约定）
t = t.replace(
  "<!DOCTYPE html>",
  `<!DOCTYPE html>
<!-- 生态岛 AI 对话版 v2：模型层 stepModel 由 fineSTEM AI 导师生成（单步手算对照验证通过：46/20/47、32/20/44、18/17/41）。
UI 层 4 处修复（下拉框选项、画面随状态绑定、动物点去随机、日志格式）按 AI 导师给出的修复方案由作者落地——
AI 的原始修正代码经平台聊天管道交付时损坏（丢失围栏、<option> 行被过滤），已记录于 dev-log。模拟步为离散计算步，非真实天数。 -->`
);

fs.writeFileSync(path.join(dir, "eco-island-ai-chat-v2.html"), t, "utf8");
console.log("修复完成:", fixes.join("；"));
console.log(
  "v2 长度:",
  t.length,
  "| 含Math.random:",
  t.includes("Math.random"),
  "| script对数:",
  (t.match(/<script/g) || []).length + "/" + (t.match(/<\/script>/g) || []).length
);
// 语法自检
const s = t.indexOf("<script");
const e = t.indexOf("</script>");
try {
  new Function(t.slice(s + 8, e));
  console.log("脚本语法: OK");
} catch (err) {
  console.log("脚本语法错误:", err.message);
  process.exit(1);
}
