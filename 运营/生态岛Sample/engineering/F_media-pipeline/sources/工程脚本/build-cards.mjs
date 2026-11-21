// 家长短视频信息卡 M4/M5a/M5b/M6/M7 —— 竖屏 1080×1920，米白纸底+墨字+朱砂单点（IP 画面规范）
// 数据源：B 包 variants/standard/notes.md 实测表 + A 包 science-notes S9（题录已核实）
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OUT = "G:/tempcache/f-pkg/cards";
mkdirSync(OUT, { recursive: true });
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };

const base = (body) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width:1080px; height:1920px; background:#F5F0E8; color:#2e2a25; font-family:"Microsoft YaHei","PingFang SC",sans-serif; position:relative; overflow:hidden; }
.paper-edge { position:absolute; inset:36px; border:2px solid rgba(46,42,37,.12); border-radius:24px; pointer-events:none; }
.tag { position:absolute; top:64px; left:88px; font-size:26px; letter-spacing:6px; color:#8a8378; }
.foot { position:absolute; bottom:96px; left:88px; right:88px; font-size:26px; color:#8a8378; line-height:1.7; }
</style></head><body>${body}</body></html>`;

// ---------- M6 三个数字 ----------
const m6 = base(`
  <div class="paper-edge"></div>
  <div class="tag">生 态 小 网 页</div>
  <div style="position:absolute; top:300px; left:0; right:0; text-align:center; font-size:54px; font-weight:bold;">整座岛，就是三个数字</div>
  <div style="position:absolute; top:560px; left:130px; right:130px; display:flex; flex-direction:column; gap:56px;">
    <div style="display:flex; align-items:center; gap:44px;">
      <div style="width:170px; height:170px; border-radius:36px; background:#e7f0e3; display:flex; align-items:center; justify-content:center; font-size:84px;">🌿</div>
      <div><div style="font-size:44px; color:#6b6459;">草</div><div style="font-size:120px; font-weight:900; line-height:1.1;">60</div></div>
    </div>
    <div style="display:flex; align-items:center; gap:44px;">
      <div style="width:170px; height:170px; border-radius:36px; background:#f7ecdd; display:flex; align-items:center; justify-content:center; font-size:84px;">🐰</div>
      <div><div style="font-size:44px; color:#6b6459;">小动物</div><div style="font-size:120px; font-weight:900; line-height:1.1;">20</div></div>
    </div>
    <div style="display:flex; align-items:center; gap:44px;">
      <div style="width:170px; height:170px; border-radius:36px; background:#e3eef5; display:flex; align-items:center; justify-content:center; font-size:84px;">💧</div>
      <div><div style="font-size:44px; color:#6b6459;">水</div><div style="font-size:120px; font-weight:900; line-height:1.1;">50</div></div>
    </div>
  </div>
  <!-- 朱砂指针：同屏仅一处 -->
  <div style="position:absolute; top:1052px; right:170px; width:64px; height:64px; border-radius:50%; background:#C0392B;"></div>
  <div style="position:absolute; top:1052px; right:120px; width:0; height:0; border-top:22px solid transparent; border-bottom:22px solid transparent; border-right:44px solid #C0392B;"></div>
  <div class="foot">三个数字都是 0 到 100 的教学指数，不是真实数量。<br>走一步，算一步：没有随机数，同样的开始，每一步都一样。</div>
`);

// ---------- M7 手算竖式 ----------
const m7 = base(`
  <div class="paper-edge"></div>
  <div class="tag">第 一 步 ，拿 笔 算</div>
  <div style="position:absolute; top:340px; left:150px; right:120px; font-family:"KaiTi","simkai",serif; font-size:64px; line-height:2.5; color:#2e2a25;">
    <div>草：60 ＋ 2 ＝ <b style="font-size:76px;">62</b></div>
    <div>　　62 − 16 ＝ <b style="font-size:76px;">46</b></div>
    <div>水：50 ＋ 3 − 6 ＝ <b style="font-size:76px;">47</b></div>
  </div>
  <!-- 朱砂指针：同屏仅一处 -->
  <div style="position:absolute; top:560px; left:96px; width:0; height:0; border-top:24px solid transparent; border-bottom:24px solid transparent; border-left:46px solid #C0392B;"></div>
  <div style="position:absolute; top:1240px; left:150px; right:150px; display:flex; align-items:center; gap:36px;">
    <div style="font-size:44px; line-height:1.7;">孩子算出来的三个数，<br>和屏幕上一模一样。</div>
  </div>
  <div class="foot">草 46／小动物 20／水 47（第 1 步）<br>数值为教学设定。</div>
`);

// ---------- M4 干旱岛对照 ----------
const row = (label, a, b, hi) => `
    <div style="display:flex; align-items:center; padding:26px 0; border-bottom:1px solid rgba(46,42,37,.1);">
      <div style="width:200px; font-size:40px; color:#6b6459;">${label}</div>
      <div style="flex:1; font-size:44px; font-variant-numeric:tabular-nums;">${a}</div>
      <div style="flex:1; font-size:44px; font-variant-numeric:tabular-nums; ${hi ? 'font-weight:900;' : ''}">${b}</div>
    </div>`;
const m4 = base(`
  <div class="paper-edge"></div>
  <div class="tag">对 照 实 验</div>
  <div style="position:absolute; top:290px; left:88px; right:88px;">
    <div style="display:flex; padding-bottom:20px; border-bottom:3px solid rgba(46,42,37,.55);">
      <div style="width:200px;"></div>
      <div style="flex:1; font-size:46px; font-weight:bold;">基础版 · 中雨</div>
      <div style="flex:1; font-size:46px; font-weight:bold;">无雨岛
        <!-- 朱砂指针：同屏仅一处 -->
        <span style="display:inline-block; width:26px; height:26px; border-radius:50%; background:#C0392B; margin-left:10px;"></span>
      </div>
    </div>
    ${row("第 9 步", "动物 0", "动物 0")}
    ${row("第 40 步", "草 44.8 · 水 100", "草 44.8 · 水 8.3")}
    ${row("第 47 步", "水 100", "水 0 · 干旱", true)}
    ${row("第 60 步", "20.8 / 4 / 100", "16.4 / 0 / 0", true)}
  </div>
  <div style="position:absolute; bottom:340px; left:0; right:0; text-align:center; font-size:60px; font-weight:900;">同一座岛，只差一场雨</div>
  <div class="foot">格子：草／小动物／水（教学指数）。<br>程序实测数据（60 步），初始 草 60／动物 20／水 50。</div>
`);

// ---------- M5a 三档对比 + 最短板 ----------
const m5a = base(`
  <div class="paper-edge"></div>
  <div class="tag">都 试 过</div>
  <div style="position:absolute; top:330px; left:110px; right:110px;">
    <div style="display:flex; align-items:center; justify-content:space-between; padding:36px 0; border-bottom:1px solid rgba(46,42,37,.1);">
      <div style="font-size:46px; white-space:nowrap;">🌤️ 小雨（每步 +1）</div>
      <div style="font-size:46px; white-space:nowrap;">第 9 步归零</div>
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; padding:36px 0; border-bottom:1px solid rgba(46,42,37,.1);">
      <div style="font-size:46px; white-space:nowrap;">🌧️ 中雨（每步 +3）</div>
      <div style="font-size:46px; white-space:nowrap;">第 9 步归零</div>
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; padding:36px 0;">
      <div style="font-size:46px; white-space:nowrap;">⛈️ 大雨（每步 +6）</div>
      <div style="font-size:46px; white-space:nowrap;">第 9 步归零</div>
    </div>
  </div>
  <div style="position:absolute; top:840px; left:110px; right:110px; text-align:center; font-size:44px; color:#6b6459;">雨给得再多，卡住小动物的，<br>是<b style="color:#2e2a25;">草的生长速度</b></div>
  <!-- 最短板墨线简笔：四块板条，草生长那块最短（朱砂=同屏唯一红色） -->
  <svg width="860" height="600" viewBox="0 0 860 600" style="position:absolute; top:1010px; left:110px;" fill="none">
    <line x1="60" y1="480" x2="800" y2="480" stroke="#2e2a25" stroke-width="6"/>
    <rect x="110" y="140" width="120" height="340" rx="14" stroke="#2e2a25" stroke-width="7"/>
    <rect x="290" y="140" width="120" height="340" rx="14" stroke="#2e2a25" stroke-width="7"/>
    <rect x="470" y="140" width="120" height="340" rx="14" stroke="#2e2a25" stroke-width="7"/>
    <rect x="650" y="330" width="120" height="150" rx="14" fill="#C0392B" fill-opacity=".14" stroke="#C0392B" stroke-width="8"/>
    <text x="170" y="540" font-family="Microsoft YaHei" font-size="34" fill="#6b6459" text-anchor="middle">雨 +1</text>
    <text x="350" y="540" font-family="Microsoft YaHei" font-size="34" fill="#6b6459" text-anchor="middle">雨 +3</text>
    <text x="530" y="540" font-family="Microsoft YaHei" font-size="34" fill="#6b6459" text-anchor="middle">雨 +6</text>
    <text x="710" y="540" font-family="Microsoft YaHei" font-size="34" fill="#C0392B" text-anchor="middle">草生长 +2</text>
    <text x="430" y="90" font-family="Microsoft YaHei" font-size="38" fill="#2e2a25" text-anchor="middle">最短的板，决定水面的高度</text>
  </svg>
  <div class="foot">三档均为程序实测（初始 草 60／动物 20／水 50）。补的不是最短板，结局不会变——限制因子。</div>
`);

// ---------- M5b 圣马太岛 ----------
const m5b = base(`
  <div class="paper-edge"></div>
  <div class="tag">现 实 里</div>
  <div style="position:absolute; top:300px; left:0; right:0; text-align:center;">
    <div style="font-size:56px; font-weight:bold;">圣马太岛驯鹿</div>
    <div style="font-size:34px; color:#8a8378; margin-top:12px;">无捕食者小岛 · 22 年</div>
  </div>
  <div style="position:absolute; top:640px; left:150px; right:150px;">
    <div style="display:flex; align-items:baseline; justify-content:space-between; padding:44px 0; border-bottom:1px solid rgba(46,42,37,.1);">
      <div style="font-size:56px; color:#6b6459;">1944</div>
      <div style="font-size:88px; font-weight:900;">29 <span style="font-size:44px; font-weight:normal;">头登岛</span></div>
    </div>
    <div style="display:flex; align-items:baseline; justify-content:space-between; padding:44px 0; border-bottom:1px solid rgba(46,42,37,.1);">
      <div style="font-size:56px; color:#6b6459;">1963</div>
      <div style="font-size:88px; font-weight:900;">约 6000 <span style="font-size:44px; font-weight:normal;">头</span></div>
    </div>
    <div style="display:flex; align-items:baseline; justify-content:space-between; padding:44px 0;">
      <div style="font-size:56px; color:#6b6459;">1966</div>
      <div style="font-size:88px; font-weight:900; color:#2e2a25;">42
        <span style="font-size:44px; font-weight:normal;">头</span>
        <!-- 朱砂指针：同屏仅一处 -->
        <span style="display:inline-block; width:26px; height:26px; border-radius:50%; background:#C0392B; margin-left:6px;"></span>
      </div>
    </div>
  </div>
  <div style="position:absolute; bottom:330px; left:0; right:0; text-align:center; font-size:56px; font-weight:900; line-height:1.5;">冲过承载力，<br>再摔下来。</div>
  <div class="foot">来源：Klein（1968）J. Wildlife Management 32(2)，题录经核实；<br>成因归因（啃食耗竭／极端风暴）在文献中有讨论空间。</div>
`);

const cards = { "M6-三个数字": m6, "M7-手算竖式": m7, "M4-对照卡": m4, "M5a-三档与最短板": m5a, "M5b-圣马太岛": m5b };
for (const [name, html] of Object.entries(cards)) {
  const f = `${OUT}/${name}.html`;
  writeFileSync(f, html);
  execFileSync("C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--headless=new", "--disable-gpu", "--hide-crash-restore-bubble",
    `--screenshot=${OUT}/${name}.png`, "--window-size=1080,1920", `file:///${f.replace(/\\/g, "/")}`,
  ], { env: ENV, stdio: "ignore", timeout: 60000 });
  console.log("card:", name);
}
console.log("done");
