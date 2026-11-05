// 少年讲解视频真实录屏编排器（v3：C 包口语化 102 句稿，逐镜定时点全部按新句长重排）
// 原理：Chrome 全屏（前台）+ gdigrab 全屏实录 + CDP 真实鼠标事件按旁白时间轴编排操作
// 2026-11-04 教训（镜6 深夜后台实录拍到桌面）：本脚本内置①录制前"桌面空闲门"（被动 z-order 检测，
//   Chrome 之上有可见窗口则等待，25 分钟仍被占用则放弃退出）②录制中"污染守卫"（watchdog 检测外来
//   窗口/失焦，命中立即中止并删除该段，绝不带坏素材出片）。实录必须前台执行。
// 用法: node record-teen.mjs [--shots s1,s2,...]   （缺省录 s1–s5、s7；s6=平台实录，由 record-shot6-v3.mjs 单独补录）
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const REC = "G:/tempcache/f-pkg/rec";
const VID = "G:/tempcache/f-pkg/video-teen";
const GUARD = "G:/tempcache/f-teen3"; // 空闲门/看门狗脚本与 flag
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const FFPROBE = "H:/dev-env/ffmpeg/bin/ffprobe.exe";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };
const LEAD = 0.8, GAP = 0.45, TAIL = 1.3;
const HOLD = { s1: 2.5, s2: 3.0, s3: 6.0, s4: 3.0, s5: 5.0, s6: 6.0, s7: 4.0 };
const DEFAULT_SHOTS = ["s1", "s2", "s3", "s4", "s5", "s7"]; // s6 平台实录走 record-shot6-v3.mjs（一次性项目，录完即删）

const args = process.argv.slice(2);
const only = args.includes("--shots") ? args[args.indexOf("--shots") + 1].split(",") : DEFAULT_SHOTS;
const timeline = JSON.parse(readFileSync("G:/tempcache/f-pkg/teen-timeline.json", "utf8"));

// ---------- 预清理：只杀我们自己 profile 的 chrome 实例（不动用户浏览器） ----------
try {
  execFileSync("powershell", ["-NoProfile", "-Command",
    "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*f-pkg/chrome-profile*' -or $_.CommandLine -like '*f-pkg\\chrome-profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Output cleaned"],
    { env: ENV, timeout: 30000, stdio: "pipe" });
} catch {}
execFileSync("powershell", ["-NoProfile", "-Command",
  "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = '1919, 1079'; Write-Output parked"], { env: ENV, timeout: 30000 });

// ---------- CDP ----------
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
      else if (m.method) this.handlers.forEach(h => h(m));
    };
  }
  send(method, params = {}, sessionId, timeoutMs = 20000) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
      this.pending.set(id, (m) => {
        clearTimeout(timer);
        m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result);
      });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=G:/tempcache/f-pkg/chrome-profile`,
  "--no-first-run", "--no-default-browser-check",
  "--start-fullscreen", "--disable-features=TranslateUI", "--lang=zh-CN",
  "--hide-crash-restore-bubble",
  "about:blank",
], { stdio: "ignore", env: ENV });

let targets = null;
for (let i = 0; i < 60; i++) {
  await sleep(400);
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch {}
}
if (!targets) { console.error("devtools endpoint not up"); process.exit(1); }
const ws = new WebSocket(targets.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const cdp = new CDP(ws);

// ---------- 桌面空闲门（被动 z-order 遮挡检测，零打扰）：Chrome 之上 90s 无可见外来窗口才开录 ----------
const chromeHwnd = parseInt(execFileSync("powershell", ["-NoProfile", "-Command",
  `(Get-Process -Id ${chrome.pid}).MainWindowHandle`], { encoding: "utf8", timeout: 15000, env: ENV }).trim());
const busy = () => {
  try {
    return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", `${GUARD}/win-busy2.ps1`, String(chromeHwnd)], { encoding: "utf8", timeout: 15000 }).trim();
  } catch { return "CLEAR"; }
};
const setTop = (mode) => {
  try { execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", `${GUARD}/win-top.ps1`, String(chromeHwnd), mode], { encoding: "utf8", timeout: 15000, env: ENV }); } catch {}
};
if (!chromeHwnd) { console.error("chrome HWND not found"); process.exit(4); }
{
  let clearSince = 0;
  const WAIT_CAP = 25 * 60 * 1000, WAIT_START = Date.now();
  let lastLog = 0;
  console.log("desktop gate: waiting for nothing above chrome (passive, no poking)…");
  while (true) {
    const b = busy();
    if (b === "CLEAR" || b === "NO_CHROME_WINDOW") {
      if (!clearSince) clearSince = Date.now();
      if (Date.now() - clearSince >= 90000) { console.log("  clear above chrome 90s — go"); break; }
    } else {
      if (clearSince) console.log("  busy again: " + b);
      clearSince = 0;
      if (Date.now() - lastLog > 60000) { console.log("  [" + new Date().toLocaleTimeString("zh-CN") + "] still busy: " + b.slice(0, 60)); lastLog = Date.now(); }
    }
    if (Date.now() - WAIT_START > WAIT_CAP) {
      console.log("RESULT: BLOCKED (desktop occupied for 25 min; screen recording deferred — rerun when the desktop is free)");
      process.exit(4);
    }
    await sleep(25000);
  }
}
// 看门狗：录制全程每 2s 查一次遮挡，BUSY 写 flag（由下方守卫读取处置）
const guardFlag = `${GUARD}/teen-flag.txt`;
try { rmSync(guardFlag, { force: true }); } catch {}
const watchdog = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", `${GUARD}/win-watch.ps1`, String(chrome.pid), guardFlag], { stdio: "ignore", env: ENV, windowsHide: true });
let contaminated = false, curSegFile = null, ffRef = null, onContaminated = null;
const guard = setInterval(async () => {
  if (contaminated) return;
  try {
    if (existsSync(guardFlag)) {
      const why = "foreign window over recording area: " + readFileSync(guardFlag, "utf8").trim();
      contaminated = true; console.error("\n  ABORT TAKE: " + why);
      try { ffRef?.kill(); } catch {}
      try { curSegFile && rmSync(curSegFile, { force: true }); } catch {}
      if (onContaminated) onContaminated();
      console.error("  contaminated segment discarded: " + curSegFile);
      console.error("RESULT: ABORTED (desktop occupied mid-take; no partial footage delivered)");
      try { await cdp.send("Browser.close"); } catch {}
      ws.close(); chrome.kill(); watchdog.kill();
      process.exit(5);
    }
  } catch {}
}, 1500);

const TABS = {}; // name -> {targetId, sessionId}
async function newTab(name, url) {
  const { targetId } = await cdp.send("Target.createTarget", { url });
  await sleep(600);
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  TABS[name] = { targetId, sessionId };
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  return TABS[name];
}
const evalOn = async (tab, expression) => {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true }, tab.sessionId);
  if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
};
const ready = async (tab) => {
  for (let i = 0; i < 50; i++) {
    if (await evalOn(tab, "document.readyState") === "complete") return;
    await sleep(200);
  }
  throw new Error("page load timeout");
};
const INJECT = `(() => {
  if (window.__recCursor) return true;
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;z-index:2147483647;width:30px;height:30px;border-radius:50%;border:3px solid rgba(255,255,255,.95);background:rgba(214,69,51,.62);box-shadow:0 0 0 2px rgba(0,0,0,.25),0 2px 10px rgba(0,0,0,.35);pointer-events:none;left:0;top:0;transform:translate(-100px,-100px);transition:transform .16s ease-out;';
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;left:9px;top:9px;width:6px;height:6px;border-radius:50%;background:#fff;';
  c.appendChild(d); (document.body || document.documentElement).appendChild(c);
  window.__recMove = (x, y) => { c.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
  return true;
})()`;
async function activate(name) {
  await cdp.send("Target.activateTarget", { targetId: TABS[name].targetId });
  await sleep(350);
  await evalOn(TABS[name], INJECT);
  await cdp.send("Page.bringToFront", {}, TABS[name].sessionId).catch(() => {});
}
async function goto(name, url, retried = 0) {
  const tab = TABS[name];
  try {
    await cdp.send("Page.navigate", { url }, tab.sessionId);
    await ready(tab);
    await evalOn(tab, INJECT);
  } catch (e) {
    if (retried < 2) { await sleep(800); return goto(name, url, retried + 1); }
    throw e;
  }
}
async function moveCursor(tab, x, y) { await evalOn(tab, `__recMove(${Math.round(x)},${Math.round(y)})`); }
async function selCenter(tab, sel) {
  return await evalOn(tab, `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
}
async function hover(tab, sel) { const xy = await selCenter(tab, sel); if (xy) await moveCursor(tab, xy[0], xy[1]); else console.log(`    [hover skip] ${sel} not found`); }
async function hoverN(tab, sel, i, dx = 0, dy = 0) {
  const [x, y] = await evalOn(tab, `(() => { const es = document.querySelectorAll(${JSON.stringify(sel)}); const r = es[Math.min(${i}, es.length - 1)].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await moveCursor(tab, x + dx, y + dy);
}
async function click(tab, sel) {
  const [x, y] = await selCenter(tab, sel);
  await moveCursor(tab, x, y); await sleep(300);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, tab.sessionId);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, tab.sessionId);
}
// 低延迟点击（预先定位好的坐标）：运行中抢拍暂停用
async function clickFast(tab, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, tab.sessionId);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, tab.sessionId);
}
async function setSelect(tab, sel, value) {
  await evalOn(tab, `(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('change')); return e.value; })()`);
}
async function findText(tab, text) {
  const ok = await evalOn(tab, `window.find(${JSON.stringify(text)})`);
  if (ok) return true;
  return await evalOn(tab, `(() => { const t=${JSON.stringify(text)}; const w=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT); let n; while(n=w.nextNode()){ if(n.textContent.includes(t)){ const r=document.createRange(); r.selectNodeContents(n); const s=getSelection(); s.removeAllRanges(); s.addRange(r); const el=n.parentElement; el.scrollIntoView({block:'center'}); return true; } } return false; })()`);
}
async function poll(tab, expr, want, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const v = await evalOn(tab, expr).catch(() => null);
    if (v === want) return true;
  }
  return false;
}
const st = (s) => s.toFixed(3);

// ---------- 修 starter 第②处（幂等） ----------
const STARTER = `${REC}/my-island.html`;
let fixLog = "not-run";
function fixStarter() {
  let src = readFileSync(STARTER, "utf8");
  const broken = "const eaten = herbivores * 0;";
  const fixed = "const eaten = herbivores * 0.8;";
  if (src.includes(broken)) { src = src.replace(broken, fixed); writeFileSync(STARTER, src); fixLog = "fixed now"; return fixLog; }
  fixLog = src.includes(fixed) ? "already fixed" : "PATTERN NOT FOUND";
  return fixLog;
}
function resetStarter() { // 从 B 包 starter 派生"已修好①③④⑤、仅剩②"的孩子工作副本（叙述口径：5 处挖坏，示范修②）
  let src = readFileSync("G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/B_作品代码/starter/eco-island.html", "utf8");
  const lines = src.split("\n");
  const out = [];
  for (const line of lines) {
    let L = line;
    if (L.includes("TODO(学生)：草忘了生长") || L.includes("提示：把下面两个 0") || L.includes("TODO(学生)：下雨档位表") || L.includes("提示：把下面 mid: 0")) continue; // 已修复项的注释删除
    if (L.includes("newGrass = grass + 0; } else { newGrass = grass + 0; }")) L = L.replace("grass + 0; } else { newGrass = grass + 0; }", "grass + 2; } else { newGrass = grass + 0.5; }");
    if (L.includes("{ low: 1, mid: 0, high: 6 }")) L = L.replace("mid: 0", "mid: 3");
    if (L.includes('$("pond").style.height = "15%"')) L = L.replace('$("pond").style.height = "15%"; // TODO(学生)：池塘高度不会变！应该和水位成正比——提示：把 "15%" 改回 Math.max(6, state.water * 0.35) + "%"', '$("pond").style.height = Math.max(6, state.water * 0.35) + "%";');
    if (L.includes("if (false) addDiary")) L = L.replace(/if \(false\) addDiary(.*)$/, 'if (prev.herbivores > 0 && next.herbivores === 0) addDiary("🐰 动物们饿肚子，全都离开小岛了……", "bad");');
    out.push(L);
  }
  src = out.join("\n");
  // 横幅与文件头注释改为"收尾"口径（孩子工作副本：5 处已修 4，剩②）
  src = src.replace("程序能跑，但有 5 个地方不对劲！搜索 TODO(学生) 找到它们，全部修好让小岛恢复生机", "收尾挑战：还剩最后 1 处不对劲（吃草量）！搜索 TODO(学生) 定位，修好让小岛恢复生机");
  if (!src.includes("TODO(学生)：动物不吃草了") || (src.match(/TODO\(学生\)/g) || []).length !== 3) throw new Error("starter 派生失败：TODO 计数不对 " + (src.match(/TODO\(学生\)/g) || []).length);
  writeFileSync(STARTER, src);
}

// ---------- 分段录制 ----------
const U = (f) => `file:///G:/tempcache/f-pkg/rec/${f}`;
const segDurOf = (t) => LEAD + t.sentences.reduce((a, s) => a + s.dur, 0) + GAP * (t.sentences.length - 1) + (HOLD[t.id] || 0) + TAIL;
function sentenceStarts(t) { let x = LEAD; return t.sentences.map(s => { const v = x; x += s.dur + GAP; return v; }); }

async function probeDur(file) {
  const out = execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return parseFloat(out.trim());
}

const segments = [];
const shots = timeline.filter(t => only.includes(t.id));
console.log(`Recording shots: ${shots.map(s => s.id).join(", ")}`);

// --- 一次性建齐全部标签页（跨镜引用安全：s5/s7 复用 c3 的 s3 结束态） ---
for (const name of ["calc", "c1", "c2", "c3", "srcStarter", "runStarter", "drought", "srcDrought", "srcRef", "archive", "docs"]) {
  await newTab(name, "about:blank");
}
console.log("tabs ready:", Object.keys(TABS).join(", "));

for (const t of shots) {
  const segDur = segDurOf(t);
  const starts = sentenceStarts(t);
  const segFile = `${VID}/${t.file}`;
  curSegFile = segFile;
  console.log(`\n=== ${t.id} ${t.title} | segDur=${st(segDur)}s ===`);

  // --- 镜前设置（不录制） ---
  if (t.id === "s1") { await goto("c1", U("checkpoint1.html")); await activate("c1"); }
  if (t.id === "s2") { await goto("calc", U("calc-paper.html")); await goto("c2", U("checkpoint2.html")); await activate("calc"); }
  if (t.id === "s3") {
    await goto("c3", U("checkpoint3.html"));
    await activate("c3");
  }
  if (t.id === "s4") {
    resetStarter();
    await goto("srcStarter", "view-source:" + U("my-island.html"));
    await goto("runStarter", U("my-island.html"));
    await activate("srcStarter");
  }
  if (t.id === "s5") {
    await goto("drought", U("my-drought.html"));
    await goto("srcDrought", "view-source:" + U("my-drought.html"));
    await goto("srcRef", "view-source:" + U("reference.html"));
    await activate("drought");
  }
  if (t.id === "s6") { await goto("archive", U("platform-archive.html")); await activate("archive"); } // 仅显式 --shots s6 时的存档代录后备（v3 未用）
  if (t.id === "s7") { await goto("docs", U("docs.html")); await activate("docs"); }

  await sleep(400);

  // --- 开始录制（Chrome 置顶：录制窗口内任何新窗口都落在 Chrome 后面） ---
  setTop("top");
  const ff = spawn(FFMPEG, [
    "-y", "-f", "gdigrab", "-framerate", "30", "-t", st(segDur), "-i", "desktop",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    segFile,
  ], { stdio: ["ignore", "ignore", "pipe"], env: ENV, windowsHide: true });
  ffRef = ff;
  const ffClosed = new Promise(res => ff.on("close", res)); // 立即挂监听，避免 close 竞态死等
  let ffErr = "";
  ff.stderr.on("data", d => { ffErr += d; });
  onContaminated = () => { setTop("notop"); };

  const t0 = Date.now() + 700; // 吸收 gdigrab 启动延迟
  const at = async (sec) => { const w = t0 + sec * 1000 - Date.now(); if (w > 0) await sleep(w); };
  const tab = () => TABS[t.tab];

  try {
    if (t.id === "s1") {
      // 13 句：0 是什么 / 1-5 变化与悬念 / 6 三个数 / 7 小动物=兔子 / 8-9 数字非真实 / 10-11 一步 / 12 收尾
      await hover(tab(), ".top h1");                                    // s1[0] 这是我的生态岛
      await at(starts[1] + 0.4); await hover(tab(), ".scene");          // s1[1] 岛上有草有兔子有水
      await at(starts[2] + 0.4); await hover(tab(), ".btns");           // s1[2] 按下开始自己变
      await at(starts[3] + 0.4); await hover(tab(), ".bunnies");        // s1[3] 草长兔子吃草
      await at(starts[4] + 0.3); await hover(tab(), ".bunnies");        // s1[4] 兔子全饿走了（悬念）
      await at(starts[5] + 0.4); await hover(tab(), ".top h1");         // s1[5] 为什么，要研究的事
      await at(starts[6] + 0.3); await hover(tab(), ".stat.g");         // s1[6] 草60（三卡各停约1s）
      await at(starts[6] + 1.8); await hover(tab(), ".stat.a");         //        小动物20
      await at(starts[6] + 3.2); await hover(tab(), ".stat.w");         //        水50
      await at(starts[7] + 0.3); await hover(tab(), ".stat.a");         // s1[7] 小动物卡与兔子同框
      await at(starts[8] + 0.3); await hover(tab(), ".stat.g");         // s1[8] 0到100之间
      await at(starts[9] + 0.3); await hover(tab(), ".stats");          // s1[9] 岛上的数字非真实
      await at(starts[10] + 0.3); await hover(tab(), ".big.bStep");     // s1[10] 按一次按钮算一步
      await at(starts[11] + 0.3); await hover(tab(), ".big.bStep");     // s1[11] 一步是算一次
      await at(starts[12] + 0.4); await hover(tab(), ".top h1");        // s1[12] 重新做出来
      await at(segDur - 1.2); await hover(tab(), ".scene");             // 收尾定格小岛
    }
    if (t.id === "s2") {
      // 24 句：0 四件事 / 1-4 长草 / 5-7 吃草 / 8-10 走留 / 11-13 算水 / 14-16 手算对程序 / 17-23 顺序重要性
      await hover(tab(), ".paper h2");                                  // s2[0] 按顺序做四件事（手算纸标题+①②③④）
      await at(starts[1] + 0.3); await hover(tab(), ".sub");            // s2[1] 第一步长草（顺序行）
      await at(starts[2] + 0.3); await hoverN(tab(), ".line", 0, -80, 0); // s2[2] 草像韭菜（草60+2=62 行）
      await at(starts[4] + 0.4); await hoverN(tab(), ".line", 0, -80, 0); // s2[4] 长到80只长0.5（同行）
      await at(starts[5] + 0.3); await hover(tab(), ".sub");            // s2[5] 第二步吃草
      await at(starts[6] + 0.3); await hoverN(tab(), ".line", 1, -80, 0); // s2[6] 一只吃0.8（62−16=46 行）
      await at(starts[8] + 0.3); await hover(tab(), ".note");           // s2[8] 第三步走留（动物20只 草62>50 注）
      await at(starts[11] + 0.3); await hoverN(tab(), ".line", 2, -80, 0); // s2[11] 第四步算水（水50+3−6=47 行）
      await at(starts[14] + 0.3); await hoverN(tab(), ".line", 0, -80, 0); // s2[14] 手算草60→62→46
      await at(starts[15] + 0.3); await hoverN(tab(), ".line", 2, -80, 0); // s2[15] 手算水50→47
      await at(starts[15] + 3.6); await activate("c2");                 // 切回程序（对程序）
      await at(starts[16] + 0.35); await click(TABS.c2, "#btnStep");    // s2[16] 再按程序→46/20/47
      await at(starts[17] + 0.3); await hover(TABS.c2, ".stepLine");    // s2[17] 顺序特别重要
      await at(starts[18] + 0.3); await hover(TABS.c2, ".stats");       // s2[18] 走不走看剩多少草
      await at(starts[20] + 0.3); await hover(TABS.c2, ".stepLine");    // s2[20] 要是反过来
      await at(starts[21] + 0.3); await hover(TABS.c2, ".stats");       // s2[21] 62>50 多来2只
      await at(starts[22] + 0.3); await hover(TABS.c2, ".stepLine");    // s2[22] 顺序一换结果换
      await at(starts[23] + 0.3); await activate("calc");               // s2[23] 先手算（回手算纸答案行）
      await at(starts[23] + 0.7); await hover(tab(), ".note");
      await at(segDur - 1.6); await activate("c2");                     // 收尾回程序 46/20/47
      await at(segDur - 1.2); await hover(TABS.c2, ".stats");
    }
    if (t.id === "s3") {
      // 16 句：0-4 铺垫+开局 / 5-7 第3/5/9步崩溃（慢速抢拍） / 8-11 归零≠灭绝+恢复 / 12 第34步 / 13 第60步 / 14-15 总结
      await hover(tab(), ".top h1");                                    // s3[0] 连跑60步会怎么样
      await at(starts[1] + 0.3); await hover(tab(), ".stepLine");       // s3[1] 先记两条命运线
      await at(starts[2] + 0.3); await hover(tab(), ".stepLine");       // s3[2] 草>50加2 / <20减3
      await at(starts[3] + 0.3); await hover(tab(), ".stats");          // s3[3] 开局吃16长2
      await at(starts[4] + 0.2); await setSelect(tab(), "#speedSel", "slow"); // 🐢 0.6s一步：第9步抢拍窗口大
      await at(19.4); await click(tab(), "#btnStart");                  // 定点起跑：第9步≈24.7s（v4 岛民口径稿 s3[7] 24.69 起；=starts[7]−5.28）
      await hover(tab(), "#btnPause");                                  // 提前把指针放到暂停键上
      const pz = await selCenter(tab(), "#btnPause");
      await poll(tab(), `vHerb.textContent`, "0", 30000);               // 第9步 动物归零
      await clickFast(tab(), pz[0], pz[1]);
      const stepNow = await evalOn(tab(), `vStep.textContent`);
      console.log(`  [s3] paused at animals=0, step=${stepNow}`);
      await at(starts[7] + 0.5); await hover(tab(), "#diary");          // s3[7] 归零——一只都不剩（日记特写）
      await at(starts[8] + 0.3); await hover(tab(), "#diary");          // s3[8-10] 归零不是灭绝/边界句（日记同框）
      await at(starts[11] + 0.3); await hover(tab(), ".scene");         // s3[11] 草悄悄长回来
      await at(starts[11] + 2.2); await setSelect(tab(), "#speedSel", "fast"); // 🐇 0.12s一步
      await at(starts[11] + 2.5); await click(tab(), "#btnStart");      // 续跑@37.96：第34步≈41.0s（s3[12] 39.15–43.42 句中停住）
      const pz2 = await selCenter(tab(), "#btnPause");
      await hover(tab(), "#btnPause");
      await poll(tab(), `vStep.textContent`, "34", 30000);              // 第34步 迁回2只
      await clickFast(tab(), pz2[0], pz2[1]);
      const step34 = await evalOn(tab(), `vStep.textContent`);
      console.log(`  [s3] paused at step=${step34}`);
      await hover(tab(), "#diary");                                     // "新动物搬来"日记条
      await at(starts[13] + 0.05); await click(tab(), "#btnStart");     // s3[13] 跑完 60
      await poll(tab(), `vStep.textContent`, "60", 30000);
      await at(starts[13] + 3.6); await hover(tab(), ".stat.g");        // 草20.8
      await at(starts[13] + 4.6); await hover(tab(), ".stat.w");        // 水100 满格
      await at(starts[14] + 0.4); await hover(tab(), "#diary");         // s3[14] 暴增崩溃恢复（日记全景）
      await at(starts[15] + 0.3); await hover(tab(), ".stepLine");      // s3[15] 两条命运线说了算
    }
    if (t.id === "s4") {
      // 9 句：0-1 5处弄坏+搜TODO / 2-3 吃草量=0 / 4 改回0.8 / 5 走一步46/20/47 / 6 修对了 / 7-8 笨办法
      await moveCursor(tab(), 700, 300);
      await at(starts[1] + 0.2); await findText(tab(), "TODO(学生)");   // s4[1] 搜TODO
      await at(starts[1] + 1.6); await findText(tab(), "TODO(学生)");   //        再搜下一个
      await at(starts[2] + 0.2); await findText(tab(), "动物不吃草了"); // s4[2] 吃草的量被改成0
      await at(starts[2] + 1.6); await findText(tab(), "const eaten");  //        定位 0
      await at(starts[4] + 0.3); fixStarter();                          // s4[4] 改回0.8（保存=写文件）
      await at(starts[4] + 0.9); await goto("srcStarter", "view-source:" + U("my-island.html")); // 刷新=保存生效
      await at(starts[4] + 2.6); await findText(tab(), "const eaten");  //        0.8 可见
      await at(starts[5] + 0.3); await activate("runStarter");          // s4[5] 再走一步
      await at(starts[5] + 0.7); await goto("runStarter", U("my-island.html")); // 运行页刷新加载修复版
      await at(starts[5] + 1.9); await click(TABS.runStarter, "#btnStep");
      const after = await evalOn(TABS.runStarter, "vGrass.textContent+'/'+vHerb.textContent+'/'+vWater.textContent");
      console.log(`  [s4] fix=${fixLog} after-step=${after} (expect 46/20/47)`);
      await at(starts[6] + 0.3); await hover(TABS.runStarter, ".stats");// s4[6] 修对了
      await at(starts[7] + 0.4); await hover(TABS.runStarter, ".stat.g");// s4[7] 笨办法
      await at(starts[8] + 0.4); await hover(TABS.runStarter, ".stepLine");// s4[8] 一次只改一处
    }
    if (t.id === "s5") {
      // 14 句：0-1 加无雨档 / 2 跑60步 / 3-6 结局（16.4/0/0） / 7 对比正常档 / 8-13 || ?? 坑
      await hover(tab(), ".top h1");
      await at(starts[0] + 0.4); await hover(tab(), "#repSel");         // s5[0] 加一个无雨档
      await at(starts[1] + 0.3);
      await evalOn(tab(), `repSel.value='low'; repSel.dispatchEvent(new Event('change')); 'ok'`); // 🌵无雨（CDP 设值=画面显示最终状态，无下拉动画——呈现层限制已标注）
      await at(starts[2] + 0.2); await setSelect(tab(), "#speedSel", "fast"); // 🐇 60 步 ≈7.2s
      await at(starts[2] + 0.5); await click(tab(), "#btnStart");       // s5[2] 跑60步
      await poll(tab(), `vStep.textContent`, "60", 30000);
      const endState = await evalOn(tab(), `vGrass.textContent+'/'+vHerb.textContent+'/'+vWater.textContent`);
      console.log(`  [s5] drought end=${endState} (expect 16.4/0/0)`);
      await at(starts[4] + 0.9); await hover(tab(), "#dryBadge");       // s5[4] 第47步水喝干（干旱徽标）
      await at(starts[5] + 0.3); await hover(tab(), ".scene");          // s5[5] 没有水草不长
      await at(starts[6] + 0.3); await hover(tab(), ".stats");          // s5[6] 16.4/0/0
      await at(starts[7] + 0.3); await activate("c3");                  // s5[7] 正常档第60步（S3 保留态 20.8/4/100）
      await at(starts[7] + 2.4); await activate("drought");             //        切回无雨档结局
      await at(starts[8] + 0.4); await hover(tab(), ".top h1");         // s5[8] 隐蔽的坑
      await at(starts[9] + 0.3); await activate("srcRef");              // s5[9] JS里0当成没有
      await at(starts[10] - 0.7); await findText(TABS.srcRef, "|| 3");  // s5[10] 用了||（高亮代码行）
      await at(starts[12] - 0.3); await activate("srcDrought");         // s5[12] 换成??
      await at(starts[12] + 0.2); await findText(TABS.srcDrought, "?? 3");
      await at(starts[13] + 0.4); await moveCursor(TABS.srcDrought, 960, 540); // s5[13] 最难忘的坑（?? 行同框）
    }
    if (t.id === "s6") {
      // （v3 未用）存档代录后备编排
      await moveCursor(tab(), 960, 500);
      await at(starts[0] + 2.0); await evalOn(tab(), `scrollTo({top:320,behavior:'smooth'})`);
      await at(starts[1] + 1.0); await evalOn(tab(), `scrollTo({top:760,behavior:'smooth'})`);
      await at(starts[3] + 1.0); await evalOn(tab(), `scrollTo({top:1180,behavior:'smooth'})`);
      await at(starts[5] + 1.0); await evalOn(tab(), `scrollTo({top:1650,behavior:'smooth'})`);
      await at(starts[6] + 1.5); await moveCursor(tab(), 760, 700);
    }
    if (t.id === "s7") {
      // 19 句：0-1 文档 / 2 两样东西 / 3-7 生态半 / 8-14 编程半（回小岛） / 15-16 三样产出（回文档） / 17 习惯 / 18 结尾回小岛
      await moveCursor(tab(), 960, 300);                                // s7[0] 这些文档
      await at(starts[1] + 0.4); await evalOn(tab(), `scrollTo({top:360,behavior:'smooth'})`);  // s7[1] 目标计划调试变更
      await at(starts[2] + 0.4); await evalOn(tab(), `scrollTo({top:900,behavior:'smooth'})`);  // s7[2] 教会我两样东西
      await at(starts[3] + 0.4); await evalOn(tab(), `scrollTo({top:1500,behavior:'smooth'})`); // s7[3] 一半是生态
      await at(starts[5] + 0.4); await moveCursor(tab(), 960, 420);     // s7[5] 承载力（文档同框停留）
      await at(starts[8] - 0.2); await activate("c3");                  // s7[8] 另一半是编程（回小岛第60步）
      await at(starts[8] + 0.8); await hover(TABS.c3, ".stepLine");     //        状态一行行算
      await at(starts[9] + 0.4); await hover(TABS.c3, ".stats");        // s7[9] 算数的代码不碰画面
      await at(starts[10] + 0.4); await hover(TABS.c3, ".scene");       // s7[10] 同数同果
      await at(starts[12] + 0.4); await hover(TABS.c3, ".stepLine");    // s7[12] if警戒线
      await at(starts[13] + 0.4); await hover(TABS.c3, ".btns");        // s7[13] 开始按钮=定时器
      await at(starts[14] + 0.4); await hover(TABS.c3, ".lab");         // s7[14] 定时器只改快慢
      await at(starts[15] + 0.3); await activate("docs");               // s7[15] 三样东西（回文档）
      await at(starts[15] + 0.7); await evalOn(tab(), `scrollTo({top:0,behavior:'smooth'})`);
      await at(starts[16] + 0.5); await evalOn(tab(), `scrollTo({top:900,behavior:'smooth'})`); // s7[16] 小岛网页/手算纸/报告
      await at(starts[17] + 0.4); await evalOn(tab(), `scrollTo({top:1500,behavior:'smooth'})`); // s7[17] 最重要的习惯
      await at(starts[18] + 0.3); await activate("c3");                 // s7[18] 你的小岛会变成什么样（回小岛定格）
      await at(starts[18] + 0.9); await hover(TABS.c3, ".top h1");
    }
  } catch (e) {
    console.error(`  [${t.id}] choreography error: ${e.message}`);
  }
  await at(segDur - 0.15); // 等到收尾
  await Promise.race([ffClosed, sleep(15000)]); // 兜底：15 秒后不再等 ffmpeg
  setTop("notop");
  if (ffErr.includes("Error")) console.error(`  ffmpeg warn: ${ffErr.slice(-300)}`);
  const dur = await probeDur(segFile);
  segments.push({ id: t.id, file: segFile, dur, title: t.title });
  console.log(`  saved ${segFile} dur=${st(dur)}s`);
}

// 汇总
writeFileSync("G:/tempcache/f-pkg/teen-segments.json", JSON.stringify(segments, null, 1));
const total = segments.reduce((a, s) => a + s.dur, 0);
console.log(`\nTOTAL: ${segments.length} segments, ${st(total)}s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")})`);
clearInterval(guard);
try { watchdog.kill(); } catch {}
try { await cdp.send("Browser.close"); } catch {}
ws.close();
chrome.kill();
