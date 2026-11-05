// 家长口播 v3（中栏铺满修订）画面资产：
//   ① 9 张中栏信息卡重出（版式与 v2 相同，640×360 设计 zoom:2 → 1280×720）；
//     唯一改动：foot 字号 13→12px——中栏铺满后卡面按 scale=1080:608+crop 上下各裁 ~4.7 设计px，
//     13px 双行脚注（M5b/M10 长脚注）会触底被裁，12px 保证单行、底边留余量。
//   ② 新增 开场小岛卡（中栏版-开场小岛.png）：B 包 reference 儿童版（rec/reference.html，
//     与 B/reference/eco-island.html 逐字节一致）第 0 步静止渲染帧 1920×1080——
//     小岛全景＋三个数字（草60/动物20/水50）同框，满足"第一眼看到小岛"（2026-11-04 用户反馈）。
// 截图用 Edge headless（--screenshot）。本机坑（沿用 v2 结论）：
//   Edge headless 视口高=窗口高−~93px → 窗口加高 120px 后 ffmpeg 裁回精确尺寸；
//   --force-device-scale-factor=2 会裁视口 → 用 body zoom:2。
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const CARDS = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/家长短视频/信息卡";
const REF = "G:/tempcache/f-pkg/rec/reference.html"; // M2 实录同一运行件（=B 包 reference 儿童版 v3）
const TMP = "G:/tempcache/e-rev2";
const ENV = { ...process.env, TEMP: TMP, TMP: TMP, TMPDIR: TMP };
mkdirSync(CARDS, { recursive: true });

const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const shot = (html, png, w, h) => {
  const f = html.replace(/\\/g, "/");
  const raw = `${TMP}/shot-raw.png`;
  execFileSync(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-crash-restore-bubble", "--no-first-run",
    `--user-data-dir=${TMP}/edge-profile`, `--screenshot=${raw}`, `--window-size=${w},${h + 120}`,
    `file:///${f}`,
  ], { env: ENV, stdio: "ignore", timeout: 60000 });
  execFileSync(FFMPEG, ["-y", "-v", "error", "-i", raw, "-vf", `crop=${w}:${h}:0:0`, "-frames:v", "1", png]);
  console.log("png:", png.split("/").pop());
};

// ---------- 开场小岛卡：reference 儿童版第 0 步渲染帧（1920×1080，与 M2 实录同取景同源） ----------
{
  const raw = `${TMP}/open-raw.png`;
  execFileSync(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-crash-restore-bubble", "--no-first-run",
    `--user-data-dir=${TMP}/edge-profile`, `--screenshot=${raw}`, "--window-size=1920,1200",
    `file:///${REF.replace(/\\/g, "/")}`,
  ], { env: ENV, stdio: "ignore", timeout: 60000 });
  execFileSync(FFMPEG, ["-y", "-v", "error", "-i", raw, "-vf", "crop=1920:1080:0:0", "-frames:v", "1",
    `${CARDS}/中栏版-开场小岛.png`]);
  console.log("png: 中栏版-开场小岛.png（reference 第 0 步渲染帧）");
}

// ---------- 中栏信息卡共享样式（640×360 设计坐标，zoom:2 → 1280×720；无朱砂，朱砂只留给字幕概念词）----------
// 所有元素一律 top 锚定（bottom 锚定在部分渲染路径下会被裁切）
const card = (label, body, foot) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>
* { box-sizing:border-box; margin:0; padding:0; }
html, body { width:640px; height:360px; }
body { background:#ECE3D2; color:#241F1B; position:relative; overflow:hidden; zoom:2;
       font-family:"Microsoft YaHei","PingFang SC",sans-serif; }
.label { position:absolute; top:20px; left:30px; font-size:15px; letter-spacing:5px; color:#8a6d33; font-weight:bold; }
.rule { position:absolute; top:50px; left:30px; right:30px; border-top:2px solid rgba(36,31,27,.16); }
.foot { position:absolute; top:328px; left:30px; right:30px; font-size:12px; color:#7d7466; line-height:1.5; }
</style></head><body>
  <div class="label">${label}</div><div class="rule"></div>
  ${body}
  ${foot ? `<div class="foot">${foot}</div>` : ""}
</body></html>`;

const cards = {};

// M6 三个数字（中栏版）
cards["中栏版-M6-三个数字"] = card("生 态 小 网 页",
  `<div style="position:absolute;top:64px;left:0;right:0;text-align:center;font-size:28px;font-weight:bold;">整座岛，就是三个数字</div>
   <div style="position:absolute;top:112px;left:30px;right:30px;display:flex;gap:14px;">
     <div style="flex:1;background:#dfe9d8;border-radius:14px;padding:12px 0 10px;text-align:center;">
       <div style="font-size:18px;color:#5d6b52;">草</div>
       <div style="font-size:56px;font-weight:900;line-height:1.1;">60</div>
       <div style="margin:4px 24px 0;height:8px;border-radius:4px;background:rgba(36,31,27,.14);"><div style="width:60%;height:100%;border-radius:4px;background:#6e7d5e;"></div></div>
     </div>
     <div style="flex:1;background:#f3e4cf;border-radius:14px;padding:12px 0 10px;text-align:center;">
       <div style="font-size:18px;color:#7a6444;">小动物</div>
       <div style="font-size:56px;font-weight:900;line-height:1.1;">20</div>
       <div style="margin:4px 24px 0;height:8px;border-radius:4px;background:rgba(36,31,27,.14);"><div style="width:20%;height:100%;border-radius:4px;background:#a07a3c;"></div></div>
     </div>
     <div style="flex:1;background:#d8e4ec;border-radius:14px;padding:12px 0 10px;text-align:center;">
       <div style="font-size:18px;color:#4f6472;">水</div>
       <div style="font-size:56px;font-weight:900;line-height:1.1;">50</div>
       <div style="margin:4px 24px 0;height:8px;border-radius:4px;background:rgba(36,31,27,.14);"><div style="width:50%;height:100%;border-radius:4px;background:#5b788c;"></div></div>
     </div>
   </div>`,
  "三个数字都是 0 到 100 的教学指数，不是真实只数、不是毫米降雨。");

// M7 手算竖式（中栏版）
cards["中栏版-M7-手算竖式"] = card("第 一 步 ，拿 笔 算",
  `<div style="position:absolute;top:66px;left:76px;font-family:KaiTi,'simkai',serif;font-size:27px;line-height:1.8;color:#241F1B;">
     <div>草：60 ＋ 2 ＝ <b style="font-size:34px;">62</b></div>
     <div>　　　62 − 16 ＝ <b style="font-size:34px;">46</b></div>
     <div>水：50 ＋ 3 − 6 ＝ <b style="font-size:34px;">47</b></div>
   </div>
   <div style="position:absolute;top:272px;left:0;right:0;text-align:center;font-size:17px;color:#6b6459;">孩子算的数，和屏幕一模一样</div>`,
  "第 1 步结果：草 46／小动物 20／水 47（数值为教学设定）。");

// M4 对照卡（中栏版）
const row = (l, a, b, hi) => `<div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid rgba(36,31,27,.10);">
  <div style="width:118px;font-size:17px;color:#6b6459;">${l}</div>
  <div style="flex:1;font-size:19px;font-variant-numeric:tabular-nums;">${a}</div>
  <div style="flex:1;font-size:19px;font-variant-numeric:tabular-nums;${hi ? "font-weight:900;" : ""}">${b}</div></div>`;
cards["中栏版-M4-对照卡"] = card("对 照 实 验",
  `<div style="position:absolute;top:62px;left:30px;right:30px;">
    <div style="display:flex;padding-bottom:7px;border-bottom:2px solid rgba(36,31,27,.45);">
      <div style="width:118px;"></div>
      <div style="flex:1;font-size:20px;font-weight:bold;">基础版 · 中雨</div>
      <div style="flex:1;font-size:20px;font-weight:bold;">无雨岛</div>
    </div>
    ${row("第 9 步", "小动物 0", "小动物 0")}
    ${row("第 47 步", "水 100", "水 0 · 干旱")}
    ${row("第 60 步", "20.8 ／ 4 ／ 100", "16.4 ／ 0 ／ 0", true)}
  </div>
  <div style="position:absolute;top:262px;left:0;right:0;text-align:center;font-size:18px;font-weight:bold;">同一座岛，只差一场雨</div>`,
  "程序实测（60 步），初始 草 60／动物 20／水 50。");

// M5a 三档与最短板（中栏版）
cards["中栏版-M5a-三档与最短板"] = card("都 试 过",
  `<div style="position:absolute;top:60px;left:30px;right:30px;font-size:17px;">
     <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(36,31,27,.10);"><span>小雨（每步 +1）</span><span style="color:#6b6459;">约第 9 步归零</span></div>
     <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(36,31,27,.10);"><span>中雨（每步 +3）</span><span style="color:#6b6459;">约第 9 步归零</span></div>
     <div style="display:flex;justify-content:space-between;padding:5px 0;"><span>大雨（每步 +6）</span><span style="color:#6b6459;">约第 9 步归零</span></div>
   </div>
   <div style="position:absolute;top:164px;left:0;right:0;text-align:center;font-size:19px;font-weight:bold;">卡住小动物的，是<b style="border-bottom:4px solid #C9A24B;">草的生长速度</b></div>
   <svg width="480" height="102" viewBox="0 0 480 102" style="position:absolute;top:212px;left:80px;" fill="none">
     <line x1="10" y1="74" x2="470" y2="74" stroke="#241F1B" stroke-width="3"/>
     <rect x="36"  y="18" width="66" height="56" rx="7" stroke="#241F1B" stroke-width="3"/>
     <rect x="155" y="18" width="66" height="56" rx="7" stroke="#241F1B" stroke-width="3"/>
     <rect x="274" y="18" width="66" height="56" rx="7" stroke="#241F1B" stroke-width="3"/>
     <rect x="393" y="48" width="66" height="26" rx="7" fill="rgba(201,162,75,.25)" stroke="#C9A24B" stroke-width="4"/>
     <text x="69"  y="94" font-size="13" fill="#6b6459" text-anchor="middle">雨 +1</text>
     <text x="188" y="94" font-size="13" fill="#6b6459" text-anchor="middle">雨 +3</text>
     <text x="307" y="94" font-size="13" fill="#6b6459" text-anchor="middle">雨 +6</text>
     <text x="426" y="40"  font-size="13" fill="#8a6d33" text-anchor="middle" font-weight="bold">草生长 +2</text>
   </svg>`,
  "三档均为程序实测 · 最短的板，决定水位。");

// M5b 圣马太岛（中栏版）
cards["中栏版-M5b-圣马太岛"] = card("现 实 里",
  `<div style="position:absolute;top:60px;left:60px;right:60px;">
    <div style="display:flex;align-items:baseline;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(36,31,27,.10);">
      <div style="font-size:22px;color:#6b6459;">1944</div><div style="font-size:32px;font-weight:900;">29 <span style="font-size:16px;font-weight:normal;">头登岛</span></div></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(36,31,27,.10);">
      <div style="font-size:22px;color:#6b6459;">1963</div><div style="font-size:32px;font-weight:900;">约 6000 <span style="font-size:16px;font-weight:normal;">头</span></div></div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;padding:8px 0;">
      <div style="font-size:22px;color:#6b6459;">1966</div><div style="font-size:32px;font-weight:900;">42 <span style="font-size:16px;font-weight:normal;">头</span></div></div>
   </div>
   <div style="position:absolute;top:246px;left:0;right:0;text-align:center;font-size:23px;font-weight:bold;">冲过承载力，再摔下来</div>`,
  "圣马太岛驯鹿 · 来源 Klein 1968/1987（题录经核实），成因归因有讨论空间。");

// M8 边界卡（中栏版）
cards["中栏版-M8-边界卡"] = card("要 说 全 的",
  `<div style="position:absolute;top:86px;left:0;right:0;text-align:center;font-size:34px;font-weight:900;">小动物归零 ≠ 物种灭绝</div>
   <div style="position:absolute;top:146px;left:0;right:0;text-align:center;font-size:20px;color:#4a443c;">草和水会自己恢复，小动物还可能迁回来</div>
   <div style="position:absolute;top:206px;left:70px;right:70px;border-top:1px dashed rgba(36,31,27,.25);padding-top:12px;text-align:center;font-size:15px;color:#6b6459;">
     科学上的灭绝：一个物种在整个地球范围内消失，不可逆</div>`,
  "作品里的「归零」是一座小岛内的状态，不等于科学意义上的灭绝。");

// M9 产出卡（中栏版）
const outRow = (n, t, s) => `<div style="display:flex;align-items:center;gap:16px;padding:9px 0;">
  <div style="width:32px;height:32px;border-radius:8px;background:rgba(201,162,75,.28);color:#8a6d33;font-weight:900;font-size:18px;display:flex;align-items:center;justify-content:center;">${n}</div>
  <div style="font-size:20px;font-weight:bold;">${t}<span style="font-size:14px;font-weight:normal;color:#6b6459;">　${s}</span></div></div>`;
cards["中栏版-M9-产出卡"] = card("孩 子 的 产 出",
  `<div style="position:absolute;top:64px;left:56px;right:40px;">
    ${outRow("一", "自己的小岛网页", "改开局、改雨量，做出自己的岛")}
    ${outRow("二", "手算记录", "每一步拿笔算，逐位对上")}
    ${outRow("三", "对照实验报告", "同一座岛，只改一个条件")}
   </div>`,
  "作品入口与说明随内容一起发布（发布时由统筹提供）。");

// M10 多结局卡（中栏版）
const endRow = (name, cond, num) => `<div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid rgba(36,31,27,.10);">
  <div style="width:150px;font-size:19px;font-weight:bold;">${name}</div>
  <div style="flex:1;font-size:15px;color:#6b6459;">${cond}</div>
  <div style="font-size:17px;font-variant-numeric:tabular-nums;font-weight:bold;">${num}</div></div>`;
cards["中栏版-M10-多结局卡"] = card("三 种 结 局",
  `<div style="position:absolute;top:62px;left:30px;right:30px;">
    ${endRow("先崩后稳", "默认 · 中雨，第 9 步归零后恢复", "20.8 ／ 4 ／ 100")}
    ${endRow("不可逆崩溃", "无雨岛 · 第 47 步水喝干", "16.4 ／ 0 ／ 0")}
    ${endRow("全程平安", "开局 草 30／动物 2，60 步没消失", "39.6 ／ 4 ／ 100")}
   </div>
   <div style="position:absolute;top:244px;left:0;right:0;text-align:center;font-size:18px;font-weight:bold;">换一种开局，命运就换一个走向</div>`,
  "格子：草／小动物／水（60 步终局），均为程序实测 · 孩子的任务：找出活路。");

// 落版（中栏版）
cards["中栏版-落版"] = card("生 态 岛 · 家 长 频 道",
  `<div style="position:absolute;top:104px;left:0;right:0;text-align:center;font-family:KaiTi,'simkai',serif;font-size:36px;font-weight:bold;">《生态岛：小岛为什么变了？》</div>
   <div style="position:absolute;top:186px;left:0;right:0;text-align:center;font-size:18px;color:#6b6459;">一座会变的小岛 · 三个数字 · 一场对照实验</div>`,
  "");

for (const [name, html] of Object.entries(cards)) {
  const f = `${CARDS}/${name}.html`;
  writeFileSync(f, html);
  shot(f, `${CARDS}/${name}.png`, 1280, 720); // 640×360 设计 × zoom2；排片时 scale=1080:608+crop 上下 8px → 铺满中栏 1080×592
}
console.log("done");
