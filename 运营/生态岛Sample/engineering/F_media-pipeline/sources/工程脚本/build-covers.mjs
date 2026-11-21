// 封面：少年横屏 1920×1080 / 家长竖屏 1080×1920（主体画面=真实作品帧+文字叠加，按《封面制作_规范》）
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";

const SRC = "G:/tempcache/f-pkg/covers-src";
const OUT = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/封面";
const TMP = "G:/tempcache/f-pkg/covers";
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

// 内嵌图片（base64 避免 file 路径问题）
const b64 = (f) => execSync(`node -e "process.stdout.write(require('fs').readFileSync('${f.replace(/\\/g, "/")}').toString('base64'))"`, { encoding: "utf8", env: ENV });
const lush = b64(`${SRC}/lush.png`);
const dry = b64(`${SRC}/dry.png`);
const teenFull = b64(`${SRC}/teen-frame-full.png`);

// ---------- 少年封面（横屏 1920×1080） ----------
const teen = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1920px;height:1080px;position:relative;overflow:hidden;font-family:"Microsoft YaHei","PingFang SC",sans-serif;}
img.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.band{position:absolute;left:0;right:0;bottom:0;height:420px;background:linear-gradient(180deg,rgba(12,32,14,0) 0%,rgba(12,32,14,.55) 30%,rgba(12,32,14,.88) 100%);}
.title{position:absolute;left:110px;bottom:200px;font-size:128px;font-weight:900;color:#fff;letter-spacing:6px;text-shadow:0 4px 14px rgba(0,0,0,.55);}
.sub{position:absolute;left:114px;bottom:96px;font-size:52px;font-weight:bold;color:#f2f7ee;letter-spacing:2px;text-shadow:0 2px 8px rgba(0,0,0,.6);}
.chip{position:absolute;left:110px;top:64px;background:#C0392B;color:#fff;font-size:40px;font-weight:900;padding:14px 34px;border-radius:999px;letter-spacing:8px;box-shadow:0 6px 16px rgba(0,0,0,.35);}
.anchor{position:absolute;right:96px;bottom:110px;color:#eaf3e6;font-size:34px;font-weight:bold;background:rgba(12,32,14,.55);padding:12px 28px;border-radius:14px;letter-spacing:3px;}
</style></head><body>
<img class="bg" src="data:image/png;base64,${teenFull}">
<div class="band"></div>
<div class="chip">少年讲解</div>
<div class="title">跟我复刻一座生态岛</div>
<div class="sub">手算对照 · 修复 Bug · 干旱岛改造</div>
<div class="anchor">真实操作实录 · 5 分钟</div>
</body></html>`;

// ---------- 家长封面（竖屏 1080×1920，米白+墨字+朱砂单点） ----------
const parent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1920px;position:relative;overflow:hidden;background:#F5F0E8;font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#2e2a25;}
.scene{position:absolute;top:270px;left:40px;width:500px;height:236px;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(46,42,37,.22);border:2px solid rgba(255,255,255,.9);}
.scene img{width:100%;height:100%;object-fit:cover;display:block;}
.label{position:absolute;top:516px;font-size:34px;font-weight:bold;color:#fff;background:rgba(30,60,32,.78);padding:8px 22px;border-radius:999px;}
.head{position:absolute;top:64px;left:0;right:0;text-align:center;font-size:44px;color:#6b6459;letter-spacing:10px;}
.split{position:absolute;top:250px;left:40px;right:40px;height:4px;background:rgba(46,42,37,.14);border-radius:2px;}
.title{position:absolute;top:880px;left:0;right:0;text-align:center;font-size:150px;font-weight:900;letter-spacing:14px;}
.sub{position:absolute;top:1120px;left:0;right:0;text-align:center;font-size:58px;font-weight:bold;color:#4a453d;letter-spacing:6px;}
.third{position:absolute;top:1260px;left:0;right:0;text-align:center;font-size:44px;color:#6b6459;letter-spacing:4px;}
.note{position:absolute;top:1420px;left:0;right:0;text-align:center;font-size:40px;color:#8a8378;letter-spacing:3px;}
</style></head><body>
<div class="head">一座小岛的对照实验</div>
<div class="split"></div>
<div class="scene" style="left:40px;"><img src="data:image/png;base64,${lush}"></div>
<div class="scene" style="left:540px;"><img src="data:image/png;base64,${dry}"></div>
<div class="label" style="left:64px;">中雨 · 动荡但活着</div>
<!-- 朱砂：同屏仅一处，标"无雨"结局 -->
<div class="label" style="left:564px;background:#C0392B;">无雨 · 全部见底</div>
<div class="title">只差一场雨</div>
<div class="sub">两种结局</div>
<div class="third">改一个条件，看哪些数字跟着变</div>
<div class="note">饭后就能和孩子聊的现象</div>
</body></html>`;

for (const [name, html, size] of [
  ["cover-teen-1920x1080", teen, "1920,1080"],
  ["cover-parent-1080x1920", parent, "1080,1920"],
]) {
  const f = `${TMP}/${name}.html`;
  writeFileSync(f, html);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-crash-restore-bubble",
    `--screenshot=${OUT}/${name}.png`, `--window-size=${size}`, `file:///${f.replace(/\\/g, "/")}`],
    { env: ENV, stdio: "ignore", timeout: 60000 });
  console.log("cover:", name);
}
// 设计稿 HTML 一并交付
writeFileSync(`${OUT}/设计稿-cover-teen.html`, teen);
writeFileSync(`${OUT}/设计稿-cover-parent.html`, parent);
console.log("done");
