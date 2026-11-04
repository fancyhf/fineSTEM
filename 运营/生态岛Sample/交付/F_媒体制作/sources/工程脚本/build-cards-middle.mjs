// 家长口播 v2（三栏式）画面资产：三栏底版 1080×1920 + 中栏演示面板信息卡 640×360（@2x 截图）
// 配色按《家长播客_规范》§三：暖深炭 #241F1B / 暖象牙 #ECE3D2 / 赭石金 #C9A24B / 朱砂只留字幕概念词（卡面不用红）
// 非真人出镜、无卡通人物、无 emoji 形象；哑光低饱和。截图用 Edge headless（--screenshot）
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const CARDS = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/家长短视频/信息卡";
const MAT = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/sources/排片样片素材";
const TMP = "G:/tempcache/e-rev";
const ENV = { ...process.env, TEMP: TMP, TMP: TMP, TMPDIR: TMP };
mkdirSync(CARDS, { recursive: true });
mkdirSync(MAT, { recursive: true });

const shot = (html, png, w, h, scale) => {
  const f = html.replace(/\\/g, "/");
  execFileSync(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-crash-restore-bubble", "--no-first-run",
    `--user-data-dir=${TMP}/edge-profile`, `--screenshot=${png}`, `--window-size=${w},${h}`,
    `--force-device-scale-factor=${scale}`, `file:///${f}`,
  ], { env: ENV, stdio: "ignore", timeout: 60000 });
  console.log("png:", png.split("/").pop());
};

// ---------- 三栏底版（1080×1920）：顶栏节目名+声波线槽位；三栏等高；底栏留给大字台词 ----------
const baseHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>
* { box-sizing:border-box; margin:0; padding:0; }
body { width:1080px; height:1920px; background:#241F1B; position:relative; overflow:hidden;
       font-family:"Microsoft YaHei","PingFang SC",sans-serif; }
.kicker { position:absolute; top:118px; left:0; right:0; text-align:center;
          font-size:26px; letter-spacing:16px; text-indent:16px; color:#C9A24B; }
.title { position:absolute; top:196px; left:0; right:0; text-align:center;
         font-family:"KaiTi","simkai",serif; font-weight:bold; font-size:96px; color:#ECE3D2; }
.sub { position:absolute; top:352px; left:0; right:0; text-align:center;
       font-size:30px; color:rgba(236,227,210,.62); letter-spacing:4px; }
.band { position:absolute; top:464px; left:0; right:0; height:160px; background:#1B1714;
        border-top:1px solid rgba(201,162,75,.32); border-bottom:1px solid rgba(201,162,75,.32); }
.band .hint { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
              font-size:22px; letter-spacing:10px; color:rgba(201,162,75,.30); }
.div { position:absolute; left:0; right:0; height:2px; background:rgba(236,227,210,.09); }
</style></head><body>
  <div class="kicker">鸡 娃 先 自 鸡</div>
  <div class="title">生态岛 · 家长频道</div>
  <div class="sub">改变一个条件，看一座小岛跟着变</div>
  <div class="band"><div class="hint">声 波 线</div></div>
  <div class="div" style="top:639px"></div>
  <div class="div" style="top:1279px"></div>
</body></html>`;
const baseFile = `${MAT}/设计稿-三栏底版.html`;
writeFileSync(baseFile, baseHtml);
shot(baseFile, `${MAT}/三栏底版.png`, 1080, 1920, 1);

// ---------- 中栏信息卡共享样式（640×360，哑光象牙纸面，无朱砂——朱砂只留给字幕概念词）----------
const card = (label, body, foot) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>
* { box-sizing:border-box; margin:0; padding:0; }
body { width:640px; height:360px; background:#ECE3D2; color:#241F1B; position:relative; overflow:hidden;
       font-family:"Microsoft YaHei","PingFang SC",sans-serif; }
.label { position:absolute; top:20px; left:30px; font-size:15px; letter-spacing:5px; color:#8a6d33; font-weight:bold; }
.rule { position:absolute; top:50px; left:30px; right:30px; border-top:2px solid rgba(36,31,27,.16); }
.foot { position:absolute; top:330px; left:30px; right:30px; font-size:13px; color:#7d7466; line-height:1.5; }
</style></head><body>
  <div class="label">${label}</div><div class="rule"></div>
  ${body}
  ${foot ? `<div class="foot">${foot}</div>` : ""}
</body></html>`;

const cards = {};

// M6 三个数字（中栏版）
cards["中栏版-M6-三个数字"] = card("生 态 小 网 页",
  `<div style="position:absolute;top:66px;left:0;right:0;text-align:center;font-size:28px;font-weight:bold;">整座岛，就是三个数字</div>
   <div style="position:absolute;top:118px;left:30px;right:30px;display:flex;gap:14px;">
     <div style="flex:1;background:#dfe9d8;border-radius:14px;padding:16px 0 12px;text-align:center;">
       <div style="font-size:18px;color:#5d6b52;">草</div>
       <div style="font-size:60px;font-weight:900;line-height:1.15;">60</div>
       <div style="margin:4px 26px 0;height:8px;border-radius:4px;background:rgba(36,31,27,.14);"><div style="width:60%;height:100%;border-radius:4px;background:#6e7d5e;"></div></div>
     </div>
     <div style="flex:1;background:#f3e4cf;border-radius:14px;padding:16px 0 12px;text-align:center;">
       <div style="font-size:18px;color:#7a6444;">小动物</div>
       <div style="font-size:60px;font-weight:900;line-height:1.15;">20</div>
       <div style="margin:4px 26px 0;height:8px;border-radius:4px;background:rgba(36,31,27,.14);"><div style="width:20%;height:100%;border-radius:4px;background:#a07a3c;"></div></div>
     </div>
     <div style="flex:1;background:#d8e4ec;border-radius:14px;padding:16px 0 12px;text-align:center;">
       <div style="font-size:18px;color:#4f6472;">水</div>
       <div style="font-size:60px;font-weight:900;line-height:1.15;">50</div>
       <div style="margin:4px 26px 0;height:8px;border-radius:4px;background:rgba(36,31,27,.14);"><div style="width:50%;height:100%;border-radius:4px;background:#5b788c;"></div></div>
     </div>
   </div>`,
  "三个数字都是 0 到 100 的教学指数，不是真实只数、不是毫米降雨。");

// M7 手算竖式（中栏版）
cards["中栏版-M7-手算竖式"] = card("第 一 步 ，拿 笔 算",
  `<div style="position:absolute;top:74px;left:70px;font-family:KaiTi,'simkai',serif;font-size:30px;line-height:2.0;color:#241F1B;">
     <div>草：60 ＋ 2 ＝ <b style="font-size:38px;">62</b></div>
     <div>　　　62 − 16 ＝ <b style="font-size:38px;">46</b></div>
     <div>水：50 ＋ 3 − 6 ＝ <b style="font-size:38px;">47</b></div>
   </div>`,
  "第 1 步结果：草 46／小动物 20／水 47（数值为教学设定）。孩子算的数和屏幕一模一样。");

// M4 对照卡（中栏版）
const row = (l, a, b, hi) => `<div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid rgba(36,31,27,.10);">
  <div style="width:118px;font-size:17px;color:#6b6459;">${l}</div>
  <div style="flex:1;font-size:19px;font-variant-numeric:tabular-nums;">${a}</div>
  <div style="flex:1;font-size:19px;font-variant-numeric:tabular-nums;${hi ? "font-weight:900;" : ""}">${b}</div></div>`;
cards["中栏版-M4-对照卡"] = card("对 照 实 验",
  `<div style="position:absolute;top:64px;left:30px;right:30px;">
    <div style="display:flex;padding-bottom:8px;border-bottom:2px solid rgba(36,31,27,.45);">
      <div style="width:118px;"></div>
      <div style="flex:1;font-size:20px;font-weight:bold;">基础版 · 中雨</div>
      <div style="flex:1;font-size:20px;font-weight:bold;">无雨岛</div>
    </div>
    ${row("第 9 步", "小动物 0", "小动物 0")}
    ${row("第 47 步", "水 100", "水 0 · 干旱")}
    ${row("第 60 步", "20.8 ／ 4 ／ 100", "16.4 ／ 0 ／ 0", true)}
  </div>`,
  "同一座岛，只差一场雨 · 程序实测（60 步），初始 草 60／动物 20／水 50。");

// M5a 三档与最短板（中栏版）
cards["中栏版-M5a-三档与最短板"] = card("都 试 过",
  `<div style="position:absolute;top:62px;left:30px;right:30px;font-size:18px;">
     <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(36,31,27,.10);"><span>小雨（每步 +1）</span><span style="color:#6b6459;">约第 9 步归零</span></div>
     <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(36,31,27,.10);"><span>中雨（每步 +3）</span><span style="color:#6b6459;">约第 9 步归零</span></div>
     <div style="display:flex;justify-content:space-between;padding:7px 0;"><span>大雨（每步 +6）</span><span style="color:#6b6459;">约第 9 步归零</span></div>
   </div>
   <div style="position:absolute;top:158px;left:0;right:0;text-align:center;font-size:20px;font-weight:bold;">卡住小动物的，是<b style="border-bottom:4px solid #C9A24B;">草的生长速度</b></div>
   <svg width="520" height="118" viewBox="0 0 520 118" style="position:absolute;top:196px;left:60px;" fill="none">
     <line x1="16" y1="94" x2="504" y2="94" stroke="#241F1B" stroke-width="4"/>
     <rect x="46"  y="30" width="72" height="64" rx="8" stroke="#241F1B" stroke-width="4"/>
     <rect x="172" y="30" width="72" height="64" rx="8" stroke="#241F1B" stroke-width="4"/>
     <rect x="298" y="30" width="72" height="64" rx="8" stroke="#241F1B" stroke-width="4"/>
     <rect x="424" y="66" width="72" height="28" rx="8" fill="rgba(201,162,75,.25)" stroke="#C9A24B" stroke-width="5"/>
     <text x="82"  y="114" font-size="14" fill="#6b6459" text-anchor="middle">雨 +1</text>
     <text x="208" y="114" font-size="14" fill="#6b6459" text-anchor="middle">雨 +3</text>
     <text x="334" y="114" font-size="14" fill="#6b6459" text-anchor="middle">雨 +6</text>
     <text x="460" y="58"  font-size="14" fill="#8a6d33" text-anchor="middle" font-weight="bold">草生长 +2</text>
   </svg>`,
  "三档均为程序实测 · 最短的板，决定水位——限制因子。");

// M5b 圣马太岛（中栏版）
cards["中栏版-M5b-圣马太岛"] = card("现 实 里",
  `<div style="position:absolute;top:62px;left:60px;right:60px;">
    <div style="display:flex;align-items:baseline;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(36,31,27,.10);">
      <div style="font-size:22px;color:#6b6459;">1944</div><div style="font-size:34px;font-weight:900;">29 <span style="font-size:17px;font-weight:normal;">头登岛</span></div></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(36,31,27,.10);">
      <div style="font-size:22px;color:#6b6459;">1963</div><div style="font-size:34px;font-weight:900;">约 6000 <span style="font-size:17px;font-weight:normal;">头</span></div></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;padding:9px 0;">
      <div style="font-size:22px;color:#6b6459;">1966</div><div style="font-size:34px;font-weight:900;">42 <span style="font-size:17px;font-weight:normal;">头</span></div></div>
   </div>
   <div style="position:absolute;top:266px;left:0;right:0;text-align:center;font-size:24px;font-weight:bold;">冲过承载力，再摔下来</div>`,
  "圣马太岛驯鹿 · 无捕食者小岛 · 来源 Klein 1968/1987（题录经核实），成因归因有讨论空间。");

// M8 边界卡（中栏版）
cards["中栏版-M8-边界卡"] = card("要 说 全 的",
  `<div style="position:absolute;top:86px;left:0;right:0;text-align:center;font-size:36px;font-weight:900;">小动物归零 ≠ 物种灭绝</div>
   <div style="position:absolute;top:150px;left:0;right:0;text-align:center;font-size:21px;color:#4a443c;">草和水会自己恢复，小动物还可能迁回来</div>
   <div style="position:absolute;top:216px;left:70px;right:70px;border-top:1px dashed rgba(36,31,27,.25);padding-top:14px;text-align:center;font-size:16px;color:#6b6459;">
     科学上的灭绝：一个物种在整个地球范围内消失，不可逆</div>`,
  "作品里的「归零」是一座小岛内的状态，不等于科学意义上的灭绝。");

// M9 产出卡（中栏版）
const outRow = (n, t, s) => `<div style="display:flex;align-items:center;gap:16px;padding:10px 0;">
  <div style="width:34px;height:34px;border-radius:8px;background:rgba(201,162,75,.28);color:#8a6d33;font-weight:900;font-size:19px;display:flex;align-items:center;justify-content:center;">${n}</div>
  <div style="font-size:21px;font-weight:bold;">${t}<span style="font-size:15px;font-weight:normal;color:#6b6459;">　${s}</span></div></div>`;
cards["中栏版-M9-产出卡"] = card("孩 子 的 产 出",
  `<div style="position:absolute;top:66px;left:56px;right:40px;">
    ${outRow("一", "自己的小岛网页", "改开局、改雨量，做出自己的岛")}
    ${outRow("二", "手算记录", "每一步拿笔算，逐位对上")}
    ${outRow("三", "对照实验报告", "同一座岛，只改一个条件")}
   </div>`,
  "作品入口与说明随内容一起发布（发布时由统筹提供）。");

// M10 多结局卡（中栏版）
const endRow = (name, cond, num) => `<div style="display:flex;align-items:center;padding:11px 0;border-bottom:1px solid rgba(36,31,27,.10);">
  <div style="width:158px;font-size:20px;font-weight:bold;">${name}</div>
  <div style="flex:1;font-size:16px;color:#6b6459;">${cond}</div>
  <div style="font-size:18px;font-variant-numeric:tabular-nums;font-weight:bold;">${num}</div></div>`;
cards["中栏版-M10-多结局卡"] = card("三 种 结 局",
  `<div style="position:absolute;top:64px;left:30px;right:30px;">
    ${endRow("先崩后稳", "默认 · 中雨，第 9 步归零后恢复", "20.8 ／ 4 ／ 100")}
    ${endRow("不可逆崩溃", "无雨岛 · 第 47 步水喝干", "16.4 ／ 0 ／ 0")}
    ${endRow("全程平安", "开局 草 30／动物 2，60 步没消失", "39.6 ／ 4 ／ 100")}
   </div>
   <div style="position:absolute;top:250px;left:0;right:0;text-align:center;font-size:19px;font-weight:bold;">换一种开局，命运就换一个走向</div>`,
  "格子：草／小动物／水（60 步终局），均为程序实测 · 孩子的任务：找出活路。");

// 落版（中栏版）
cards["中栏版-落版"] = card("生 态 岛 · 家 长 频 道",
  `<div style="position:absolute;top:96px;left:0;right:0;text-align:center;font-family:KaiTi,'simkai',serif;font-size:40px;font-weight:bold;">《生态岛：小岛为什么变了？》</div>
   <div style="position:absolute;top:186px;left:0;right:0;text-align:center;font-size:19px;color:#6b6459;">一座会变的小岛 · 三个数字 · 一场对照实验</div>`,
  "");

for (const [name, html] of Object.entries(cards)) {
  const f = `${CARDS}/${name}.html`;
  writeFileSync(f, html);
  shot(f, `${CARDS}/${name}.png`, 640, 360, 2); // @2x → 1280×720，视频内缩至 568×320（≤中栏 640px 的一半）
}
console.log("done");
