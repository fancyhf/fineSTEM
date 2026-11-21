// M2 作品实录（家长视频专用，独立于少年视频素材；《三视频边界总纲》：作品录屏属实拍，独立补录）
// 编排：载入 reference.html → 🐢点开始(走3步) → 暂停 → 走一步(46/20/47锚点) → 🐇续跑至60(日记滚动) → 结尾停留
import { spawn, execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const PORT = 9444;
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };
const OUT = "G:/tempcache/f-pkg/m2/m2-take.mp4";

// 预清理自己的 chrome
try {
  execFileSync("powershell", ["-NoProfile", "-Command",
    "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*f-pkg*chrome-profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Output c"],
    { env: ENV, timeout: 30000 });
} catch {}
execFileSync("powershell", ["-NoProfile", "-Command", "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position='1919,1079'"], { env: ENV, timeout: 30000 });

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`, "--user-data-dir=G:/tempcache/f-pkg/chrome-profile",
  "--no-first-run", "--no-default-browser-check", "--start-fullscreen",
  "--disable-features=TranslateUI", "--lang=zh-CN", "--hide-crash-restore-bubble",
  "about:blank",
], { stdio: "ignore", env: ENV });

let ver = null;
for (let i = 0; i < 60; i++) { await sleep(400); try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch {} }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}, sessionId, timeoutMs = 20000) => new Promise((res, rej) => {
  const i = ++id; const t = setTimeout(() => { pend.delete(i); rej(new Error("timeout " + method)); }, timeoutMs);
  pend.set(i, (m) => { clearTimeout(t); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); });
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
await sleep(500);
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true }, sessionId)).result?.value;
const INJ = `(() => { if (window.__rc) return; const c=document.createElement('div'); c.style.cssText='position:fixed;z-index:2147483647;width:30px;height:30px;border-radius:50%;border:3px solid rgba(255,255,255,.95);background:rgba(214,69,51,.62);box-shadow:0 0 0 2px rgba(0,0,0,.25),0 2px 10px rgba(0,0,0,.35);pointer-events:none;left:0;top:0;transform:translate(-100px,-100px);transition:transform .16s ease-out;'; document.body.appendChild(c); window.__rc=c; window.__m=(x,y)=>{c.style.transform='translate('+x+'px,'+y+'px)';}; })()`;
await send("Page.navigate", { url: "file:///G:/tempcache/f-pkg/rec/reference.html" }, sessionId);
for (let i = 0; i < 50; i++) { if (await ev("document.readyState") === "complete") break; await sleep(200); }
await ev(INJ);
await send("Page.bringToFront", {}, sessionId).catch(() => {});
const center = async (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
const click = async (sel) => { const [x, y] = await center(sel); await ev(`__m(${Math.round(x)},${Math.round(y)})`); await sleep(320); await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, sessionId); await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, sessionId); };
const poll = async (expr, want, maxMs) => { const t0 = Date.now(); while (Date.now() - t0 < maxMs) { if (await ev(expr) === want) return; } };

const DUR = 26;
const ff = spawn(FFMPEG, ["-y", "-f", "gdigrab", "-framerate", "30", "-t", String(DUR), "-i", "desktop",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", OUT],
  { stdio: ["ignore", "ignore", "pipe"], env: ENV, windowsHide: true });
const ffClosed = new Promise(res => ff.on("close", res));

const t0 = Date.now() + 700;
const at = async (s) => { const w = t0 + s * 1000 - Date.now(); if (w > 0) await sleep(w); };

await at(0.3); await ev("__m(960,300)");
await at(1.0); await click("#btnStart");            // 🐢 0.6s一步，数字可见跳动（p2 插片窗口）
await at(3.2); await click("#btnPause");
await at(4.2); await click("#btnReset");            // 重来 → 60/20/50 第0步
await at(5.4); await click("#btnStep");             // 走一步 → 46/20/47（p3 插片窗口，锚点）
await at(9.6);
await ev(`speedSel.value='fast'; speedSel.dispatchEvent(new Event('change')); 'ok'`);
await at(10.2); await click("#btnStart");           // 🐇 续跑至60，日记滚动（p7 插片窗口）
await poll("vStep.textContent", "60", 20000);
await at(17.0); await ev("__m(1330,930)");          // 指针停在日记区
await at(DUR - 0.2);
await Promise.race([ffClosed, sleep(15000)]);
console.log("m2 take saved");
const st = await ev(`vGrass.textContent+'/'+vHerb.textContent+'/'+vWater.textContent+'/'+vStep.textContent`);
console.log("end state:", st);
try { await send("Browser.close"); } catch {}
ws.close(); chrome.kill();
