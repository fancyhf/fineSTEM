// 少年讲解视频真实录屏编排器
// 原理：Chrome 全屏（前台）+ gdigrab 全屏实录 + CDP 真实鼠标事件按旁白时间轴编排操作
// 用法: node record-teen.mjs [--shots s1,s2,...]   （缺省录全部 7 镜）
import { spawn, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const REC = "G:/tempcache/f-pkg/rec";
const VID = "G:/tempcache/f-pkg/video-teen";
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const FFPROBE = "H:/dev-env/ffmpeg/bin/ffprobe.exe";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };
const LEAD = 0.8, GAP = 0.45, TAIL = 1.3;
const HOLD = { s1: 2.5, s2: 3.0, s3: 6.0, s4: 3.0, s5: 5.0, s6: 6.0, s7: 4.0 };

const args = process.argv.slice(2);
const only = args.includes("--shots") ? args[args.indexOf("--shots") + 1].split(",") : null;
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
  return await evalOn(tab, `(() => { const e = document.querySelector(${JSON.stringify(sel)}); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
}
async function hover(tab, sel) { const [x, y] = await selCenter(tab, sel); await moveCursor(tab, x, y); }
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
function resetStarter() { // 从 B 包 starter 派生"已修好①③④⑤、仅剩②"的孩子工作副本（叙述口径：5 处挖坏，示范修最后一处②）
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
  src = src.replace("程序能跑，但有 5 个地方不对劲！搜索 TODO(学生) 找到它们，全部修好让小岛恢复生机", "收尾挑战：还剩最后 1 处不对劲（吃草系数）！搜索 TODO(学生) 定位，修好让小岛恢复生机");
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
const shots = timeline.filter(t => !only || only.includes(t.id));
console.log(`Recording shots: ${shots.map(s => s.id).join(", ")}`);

// --- 一次性建齐全部标签页（跨镜引用安全） ---
for (const name of ["calc", "c1", "c2", "c3", "srcStarter", "runStarter", "drought", "srcDrought", "srcRef", "archive", "docs"]) {
  await newTab(name, "about:blank");
}
console.log("tabs ready:", Object.keys(TABS).join(", "));

for (const t of shots) {
  const segDur = segDurOf(t);
  const starts = sentenceStarts(t);
  const segFile = `${VID}/${t.file}`;
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
  if (t.id === "s6") { await goto("archive", U("platform-archive.html")); await activate("archive"); }
  if (t.id === "s7") { await goto("docs", U("docs.html")); await activate("docs"); }

  await sleep(400);

  // --- 开始录制 ---
  const ff = spawn(FFMPEG, [
    "-y", "-f", "gdigrab", "-framerate", "30", "-t", st(segDur), "-i", "desktop",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    segFile,
  ], { stdio: ["ignore", "ignore", "pipe"], env: ENV, windowsHide: true });
  const ffClosed = new Promise(res => ff.on("close", res)); // 立即挂监听，避免 close 竞态死等
  let ffErr = "";
  ff.stderr.on("data", d => { ffErr += d; });

  const t0 = Date.now() + 700; // 吸收 gdigrab 启动延迟
  const at = async (sec) => { const w = t0 + sec * 1000 - Date.now(); if (w > 0) await sleep(w); };
  const tab = () => TABS[t.tab];

  try {
    if (t.id === "s1") {
      await hover(tab(), ".top h1");
      await at(starts[1] + 0.4); await hover(tab(), ".stat.g");
      await at(starts[1] + 2.4); await hover(tab(), ".stat.a");
      await at(starts[1] + 4.4); await hover(tab(), ".stat.w");
      await at(starts[2] + 0.5); await hover(tab(), ".stepLine");
      await at(starts[3] + 0.5); await hover(tab(), ".top h1");
      await at(segDur - 1.2); await hover(tab(), ".scene");
    }
    if (t.id === "s2") {
      await hover(tab(), ".paper h2");
      await at(starts[1] + 0.6); await hoverN(tab(), ".line", 0, -80, 0);
      await at(starts[1] + 2.8); await hoverN(tab(), ".line", 1, -80, 0);
      await at(starts[1] + 5.0); await hoverN(tab(), ".line", 2, -80, 0);
      await at(starts[1] + 7.0); await hover(tab(), ".note");
      await at(starts[1] + 7.6); await activate("c2");
      await at(starts[2] + 0.25); await click(TABS.c2, "#btnStep");
      await at(starts[3] + 0.4); await hover(TABS.c2, ".stats");
      await at(starts[3] + 1.6); await hover(TABS.c2, ".stepLine");
    }
    if (t.id === "s3") {
      await hover(tab(), ".top h1");
      await at(starts[0] + 0.2); await setSelect(tab(), "#speedSel", "slow"); // 🐢 0.6s一步：第9步抢拍窗口大
      await at(starts[0] + 0.8); await click(tab(), "#btnStart");
      await hover(tab(), "#btnPause"); // 提前把指针放到暂停键上
      const pz = await selCenter(tab(), "#btnPause");
      await poll(tab(), `vHerb.textContent`, "0", 30000);
      await clickFast(tab(), pz[0], pz[1]);
      const stepNow = await evalOn(tab(), `vStep.textContent`);
      console.log(`  [s3] paused at animals=0, step=${stepNow}`);
      await at(starts[1] + 1.0); await hover(tab(), "#diary");
      await at(starts[2] - 0.35); await setSelect(tab(), "#speedSel", "fast"); // 🐇 0.12s一步
      await at(starts[2] - 0.05); await click(tab(), "#btnStart"); // 续跑
      const pz2 = await selCenter(tab(), "#btnPause");
      await hover(tab(), "#btnPause");
      await poll(tab(), `vStep.textContent`, "34", 30000);
      await clickFast(tab(), pz2[0], pz2[1]);
      const step34 = await evalOn(tab(), `vStep.textContent`);
      console.log(`  [s3] paused at step=${step34}`);
      await hover(tab(), "#diary");
      await at(starts[3] + 0.35); await click(tab(), "#btnStart"); // 跑完 60
      await poll(tab(), `vStep.textContent`, "60", 30000);
      await at(starts[4] + 0.4); await hover(tab(), ".stat.g");
      await at(starts[4] + 1.5); await hover(tab(), ".stat.w");
    }
    if (t.id === "s4") {
      await moveCursor(tab(), 700, 300);
      await at(starts[0] + 0.6); await findText(tab(), "TODO(学生)");
      await at(starts[0] + 2.2); await findText(tab(), "TODO(学生)");
      await at(starts[1] + 0.4); await findText(tab(), "动物不吃草了");
      await at(starts[1] + 2.2); await findText(tab(), "const eaten");
      await at(starts[2] + 0.2); fixStarter();
      await at(starts[2] + 0.7); await goto("srcStarter", "view-source:" + U("my-island.html")); // 刷新=保存生效
      await at(starts[2] + 2.6); await findText(tab(), "const eaten");
      await at(starts[2] + 4.6); await activate("runStarter");
      await at(starts[2] + 4.9); await goto("runStarter", U("my-island.html")); // 运行页刷新加载修复版
      await at(starts[2] + 6.2); await click(TABS.runStarter, "#btnStep");
      const after = await evalOn(TABS.runStarter, "vGrass.textContent+'/'+vHerb.textContent+'/'+vWater.textContent");
      console.log(`  [s4] fix=${fixLog} after-step=${after} (expect 46/20/47)`);
      await at(starts[3] + 0.3); await hover(TABS.runStarter, ".stats");
      await at(starts[4] + 0.5); await hover(TABS.runStarter, ".stat.g");
      await at(starts[4] + 2.2); await hover(TABS.runStarter, ".stepLine");
    }
    if (t.id === "s5") {
      await hover(tab(), ".top h1");
      await at(starts[0] + 0.8); await hover(tab(), "#repSel");
      await at(starts[0] + 1.4);
      await evalOn(tab(), `repSel.value='low'; repSel.dispatchEvent(new Event('change')); 'ok'`);
      await at(starts[1] + 0.1); await setSelect(tab(), "#speedSel", "fast"); // 🐇 60 步 ≈7.2s，节拍与旁白对齐
      await at(starts[1] + 0.3); await click(tab(), "#btnStart");
      await poll(tab(), `vStep.textContent`, "60", 30000);
      const endState = await evalOn(tab(), `vGrass.textContent+'/'+vHerb.textContent+'/'+vWater.textContent`);
      console.log(`  [s5] drought end=${endState}`);
      await at(starts[2] + 0.6); await hover(tab(), "#dryBadge");
      await at(starts[3] + 0.3); await activate("c3");        // 默认档第60步（S3 保留态）
      await at(starts[3] + 1.9); await activate("drought");   // 切回无雨档结局
      await at(starts[4] + 0.4); await activate("srcRef"); await findText(TABS.srcRef, "|| 3");
      await at(starts[4] + 4.0); await activate("srcDrought"); await findText(TABS.srcDrought, "?? 3");
    }
    if (t.id === "s6") {
      await moveCursor(tab(), 960, 500);
      await at(starts[0] + 2.0); await evalOn(tab(), `scrollTo({top:320,behavior:'smooth'})`);
      await at(starts[0] + 6.0); await evalOn(tab(), `scrollTo({top:760,behavior:'smooth'})`);
      await at(starts[0] + 9.5); await evalOn(tab(), `scrollTo({top:1180,behavior:'smooth'})`);
      await at(starts[1] + 1.0); await evalOn(tab(), `scrollTo({top:1650,behavior:'smooth'})`);
      await at(starts[1] + 3.5); await moveCursor(tab(), 760, 700);
    }
    if (t.id === "s7") {
      await moveCursor(tab(), 960, 300);
      await at(starts[0] + 1.5); await evalOn(tab(), `scrollTo({top:360,behavior:'smooth'})`);
      await at(starts[1] + 0.5); await evalOn(tab(), `scrollTo({top:900,behavior:'smooth'})`);
      await at(starts[1] + 4.5); await evalOn(tab(), `scrollTo({top:1500,behavior:'smooth'})`);
      await at(starts[2] + 0.4); await activate("c3"); // 回小岛第60步画面
      await at(starts[2] + 1.5); await hover(TABS.c3, ".stepLine");
      await at(starts[3] + 0.4); await hover(TABS.c3, ".top h1");
    }
  } catch (e) {
    console.error(`  [${t.id}] choreography error: ${e.message}`);
  }
  await at(segDur - 0.15); // 等到收尾
  await Promise.race([ffClosed, sleep(15000)]); // 兜底：15 秒后不再等 ffmpeg
  if (ffErr.includes("Error")) console.error(`  ffmpeg warn: ${ffErr.slice(-300)}`);
  const dur = await probeDur(segFile);
  segments.push({ id: t.id, file: segFile, dur, title: t.title });
  console.log(`  saved ${segFile} dur=${st(dur)}s`);
}

// 汇总
writeFileSync("G:/tempcache/f-pkg/teen-segments.json", JSON.stringify(segments, null, 1));
const total = segments.reduce((a, s) => a + s.dur, 0);
console.log(`\nTOTAL: ${segments.length} segments, ${st(total)}s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")})`);
try { await cdp.send("Browser.close"); } catch {}
ws.close();
chrome.kill();
