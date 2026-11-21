// 构建录制辅助页：手算纸 / 平台存档展示页 / 文档展示页
// 手算纸与存档页为"制作件"（道具与资料画面），页面上明示标注；文档页引用 D 包真实模板 + B 包真实 dev-log
import { readFileSync, writeFileSync } from "node:fs";

const REC = "G:/tempcache/f-pkg/rec";

// ---------- 1) 手算纸（镜2 道具） ----------
const calc = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>手算纸</title>
<style>
  body { margin:0; background:#e8e4da; display:flex; align-items:center; justify-content:center; min-height:100vh; font-family:"KaiTi","simkai",serif; }
  .paper { width:860px; background:#fdfcf7; padding:56px 72px 64px; box-shadow:0 12px 40px rgba(0,0,0,.28); transform:rotate(-.6deg); position:relative; }
  .paper::before { content:""; position:absolute; left:64px; top:0; bottom:0; width:2px; background:#e08a8a; }
  h2 { font-size:30px; color:#3a3a3a; margin:0 0 8px 32px; letter-spacing:2px;}
  .sub { margin:0 0 28px 32px; font-size:18px; color:#8a8578; }
  .line { margin-left:32px; font-size:34px; line-height:1.9; color:#2f2f2f; }
  .line b { color:#b03a2e; }
  .tag { position:absolute; right:24px; top:20px; font-family:"Microsoft YaHei"; font-size:14px; color:#fff; background:#c0392b; border-radius:6px; padding:4px 10px;}
  .note { margin:28px 0 0 32px; font-size:19px; color:#6b6353; }
</style></head><body>
<div class="paper">
  <span class="tag">拍摄道具（制作件）</span>
  <h2>手算纸 · 第 1 步</h2>
  <p class="sub">顺序固定：①草长高 → ②动物吃草 → ③动物去留 → ④算水</p>
  <div class="line">草：60 ＋ 2 ＝ <b>62</b>　（有水，草少于80，长2）</div>
  <div class="line">　　　62 − 16 ＝ <b>46</b>　（20只 × 每只吃0.8）</div>
  <div class="line">水：50 ＋ 3 − 6 ＝ <b>47</b>　（中雨补3，动物喝6）</div>
  <p class="note">动物：20 只（草 62 &gt; 50，下一步才会 +2）</p>
  <p class="note">答案：草 46 ／ 动物 20 ／ 水 47 —— 等下和程序对一对！</p>
</div></body></html>`;

// ---------- 2) 平台存档展示页（镜6 代录画面，明示存档） ----------
const archive = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>镜6 存档画面</title>
<style>
  body { margin:0; background:#f4f2ec; font-family:"Microsoft YaHei"; }
  .banner { position:sticky; top:0; z-index:9; background:#fff3cd; color:#7a5b00; border-bottom:2px solid #e6c860; padding:14px 24px; font-size:22px; font-weight:bold; }
  .wrap { max-width:1500px; margin:24px auto; display:flex; flex-direction:column; gap:28px; }
  figure { margin:0; background:#fff; border-radius:12px; padding:18px; box-shadow:0 4px 14px rgba(0,0,0,.12); }
  img { width:100%; border:1px solid #ddd; border-radius:8px; }
  figcaption { font-size:18px; color:#555; margin-top:10px; line-height:1.6; }
  figcaption b { color:#1b5e20; }
</style></head><body>
<div class="banner">⚠️ 存档画面（非本次录制）：2026-11-02 平台实测截图（B-E001 / B-E002）。镜 6 平台实时操作待真人补录（需平台账号）。</div>
<div class="wrap">
  <figure>
    <img src="B-E001_工作台运行预览.png">
    <figcaption><b>① 编辑器粘贴代码 → 保存 → 运行</b>：左侧代码编辑器，右侧 iframe 沙箱预览，运行后小岛渲染正常（证据 B-E001，2026-11-02 生产站实测）。</figcaption>
  </figure>
  <figure>
    <img src="B-E002_成果档案卡页面.png">
    <figcaption><b>② 成果档案卡（5 字段）</b>：title / one_liner / problem_solved / method_used / reflection，保存后可同步能力标签（证据 B-E002，平台私有状态）。</figcaption>
  </figure>
</div></body></html>`;

// ---------- 3) 文档展示页（镜7：D 包模板 + B 包真实开发日志） ----------
const devlog = readFileSync("G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/B_作品代码/dev-log.md", "utf8");
const devlogLines = devlog.split("\n").filter(l => l.trim()).slice(0, 60).join("\n");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const docs = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>项目文档档案</title>
<style>
  body { margin:0; background:#f4f2ec; font-family:"Microsoft YaHei"; }
  .banner { position:sticky; top:0; z-index:9; background:#e8f5e9; color:#1b5e20; border-bottom:2px solid #a5d6a7; padding:12px 24px; font-size:20px; font-weight:bold; }
  .grid { max-width:1560px; margin:24px auto; display:grid; grid-template-columns:1fr 1fr; gap:22px; }
  .doc { background:#fff; border-radius:14px; padding:20px 24px; box-shadow:0 4px 14px rgba(0,0,0,.1); }
  .doc h3 { margin:0 0 6px; font-size:24px; color:#1b5e20; }
  .doc .st { font-size:14px; color:#fff; background:#ef6c00; border-radius:6px; padding:2px 10px; margin-left:10px; vertical-align:middle;}
  .doc p { font-size:16px; color:#666; margin:6px 0 0; line-height:1.6; }
  pre { background:#fff; border-radius:14px; padding:22px 26px; margin:0 auto 30px; max-width:1500px; font-size:15px; line-height:1.7; color:#333; white-space:pre-wrap; font-family:Consolas,monospace; box-shadow:0 4px 14px rgba(0,0,0,.1); }
  .logtitle { max-width:1500px; margin:34px auto 12px; font-size:24px; font-weight:bold; color:#1b5e20; }
</style></head><body>
<div class="banner">📔 项目过程档案｜上方四份为 D 包文档模板（已填示例待 D 包第二阶段）；下方为 B 包真实开发日志（含全部真实失败与修复）</div>
<div class="grid">
  <div class="doc"><h3>01-开题<span class="st">模板</span></h3><p>目标、问题、范围：我要做什么小岛，什么算做完。</p></div>
  <div class="doc"><h3>03-任务计划<span class="st">模板</span></h3><p>拆任务、定顺序：界面→模型→对照→改造，每步有验收。</p></div>
  <div class="doc"><h3>05-开发与调试<span class="st">模板</span></h3><p>问题、假设、修复、复验：每次 bug 都走一遍完整闭环。</p></div>
  <div class="doc"><h3>07-变更记录<span class="st">模板</span></h3><p>改了什么、为什么改：规则改动必须留下痕迹。</p></div>
</div>
<div class="logtitle">𝐫𝐞𝐚𝐥 开发日志（B 包 dev-log.md 摘录：真实失败与修复）</div>
<pre>${esc(devlogLines)}</pre>
</body></html>`;

writeFileSync(`${REC}/calc-paper.html`, calc);
writeFileSync(`${REC}/platform-archive.html`, archive);
writeFileSync(`${REC}/docs.html`, docs);

// 拷贝存档截图（file:// img 需要同目录可访问；子路径亦可，直接放同目录最稳）
for (const f of ["B-E001_工作台运行预览.png", "B-E002_成果档案卡页面.png"]) {
  const src = `G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/B_作品代码/evidence/${f}`;
  writeFileSync(`${REC}/${f}`, readFileSync(src));
}
console.log("pages built:", ["calc-paper.html", "platform-archive.html", "docs.html"].join(", "));
