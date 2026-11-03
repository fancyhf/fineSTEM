// 家长排片样片：真人出镜占位卡（M1 缺，如实标注）+ 落版卡
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OUT = "G:/tempcache/f-pkg/placeholders";
mkdirSync(OUT, { recursive: true });
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const card = (no, line, tips) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1920px;background:#F5F0E8;font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#2e2a25;position:relative;}
.frame{position:absolute;inset:36px;border:2px dashed rgba(192,57,43,.55);border-radius:26px;}
.badge{position:absolute;top:200px;left:0;right:0;text-align:center;}
.badge span{display:inline-block;font-size:40px;font-weight:900;color:#C0392B;border:3px solid #C0392B;border-radius:999px;padding:16px 44px;letter-spacing:8px;}
.no{position:absolute;top:360px;left:0;right:0;text-align:center;font-size:52px;color:#6b6459;letter-spacing:6px;}
.line{position:absolute;top:840px;left:120px;right:120px;text-align:center;font-size:62px;line-height:1.8;font-weight:bold;}
.tips{position:absolute;bottom:200px;left:140px;right:140px;font-size:34px;color:#8a8378;line-height:1.8;}
</style></head><body>
<div class="frame"></div>
<div class="badge"><span>真人出镜 · 待拍摄</span></div>
<div class="no">${no}</div>
<div class="line">${line}</div>
<div class="tips">${tips}</div>
</body></html>`;

const endcard = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1920px;background:#F5F0E8;font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#2e2a25;position:relative;}
.name{position:absolute;top:820px;left:0;right:0;text-align:center;font-size:84px;font-weight:900;letter-spacing:4px;line-height:1.5;}
.rule{position:absolute;top:1160px;left:330px;right:330px;height:4px;background:rgba(46,42,37,.25);}
.entry{position:absolute;top:1230px;left:0;right:0;text-align:center;font-size:40px;color:#8a8378;line-height:1.8;}
.mark{position:absolute;bottom:120px;left:0;right:0;text-align:center;font-size:30px;color:#b7b0a4;letter-spacing:4px;}
</style></head><body>
<div class="name">生态岛<br>小岛为什么变了？</div>
<div class="rule"></div>
<div class="entry">作品入口与发布日期由统筹在发布时提供<br>（落版占位，非正式落版）</div>
<div class="mark">排片样片 · 落版占位卡</div>
</body></html>`;

const cards = [
  ["P1-真人占位", card("镜头 1", "“把一座小岛的雨关掉，<br>接下来会发生什么。”", "拍摄要点：真人出镜，简洁背景；主体靠中上；<br>画面右侧浮出作品首帧（儿童版 v3，素材 M2/M3）；<br>朱砂指针点在“下雨快慢”下拉上。")],
  ["P5b-真人占位", card("镜头 5 后半", "“还有一句要说全：岛上小动物归零，<br>草和水会自己恢复，<br>不等于物种灭绝。”", "拍摄要点：真人出镜讲边界句；两句式完整保留；<br>字幕概念词“限制因子”朱砂内嵌在前半段。")],
  ["P7-真人占位", card("镜头 7", "“作品入口随内容一起发布，<br>打开两三分钟就够。”", "拍摄要点：真人出镜；插入小岛日记滚动特写（M2 补录）；<br>朱砂指针点日记行。")],
  ["P8-真人占位", card("镜头 8", "“改变一个条件，<br>看哪些数字跟着变。”", "拍摄要点：真人出镜收尾；淡出到作品全景帧；<br>接落版卡。")],
  ["P8b-落版", endcard],
];
for (const [name, html] of cards) {
  const f = `${OUT}/${name}.html`;
  writeFileSync(f, html);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-crash-restore-bubble",
    `--screenshot=${OUT}/${name}.png`, "--window-size=1080,1920", `file:///${f.replace(/\\/g, "/")}`],
    { env: ENV, stdio: "ignore", timeout: 60000 });
  console.log("placeholder:", name);
}
