// 家长口播三栏样片 v4 · 底栏字幕层重制（2026-11-05/06，用户反馈："下栏文字字体小，不算是多种版式轮换的大字报字幕"）
//
// 定位：build-parent-post-v4.mjs（母版：口播/旁白/顶中栏/剪辑，2026-11-05）之后的**字幕层专用工序**。
//   母版的旧字幕渲染（fs 52/64 固定小字）被本工序取代；重跑母版后必须再跑本脚本完成字幕层。
// 输入：
//   ① 家长短视频/生态岛-家长口播-三栏样片-v4.mp4 —— 现行母版（音画 0.00s、顶栏/中栏不动，音频流直拷）
//   ② 家长短视频/生态岛-家长口播-三栏-v4.srt —— 母版按逐句 wav 修剪实测时长生成的块式切分
//      （本脚本逐条校验切分参数后原样复用时间轴；旁白音频零改动=复用不重配）
// 输出：同名 v4.mp4（底栏大字报字幕层重渲染）+ 同名 v4.srt（重出，UTF-8 BOM）
// 旧渲染版转存 存档/。
//
// 规范依据：《家长播客_规范》§三 底栏条款、§八 字幕块式。5 条落实：
//   1. 底栏=竖屏下 1/3（y1280–1920），大字台词块居中铺陈该栏（单行 fs≤124 / 双行 fs≤106，随块长自适应）
//   2. 每句 1–2 行字幕块逐块显示（沿用母版 pack() 切分：行≤14、块≤20，标点保留行尾）
//   3. 块时长=块字符数占整句比例，保底 0.35s（≥规范 0.3s）；单句时长=逐句 wav 修剪实测（母版已做，SRT 复用）
//   4. 错落三预设按块序号轮换：居中/左置(缩进120,an1)/右置(缩进120,an3)；双行第二行 ±16px 横向错位（方向随块奇偶交替）
//   5. 概念词内嵌强调：原地放大 ×1.32 + 朱砂 #C0392B，每块至多一处、块间时序不重叠 → 同屏仅一处；无整屏概念大字
// 合成方式：底栏背景为纯色 #241F1B（底版实测，仅 y1279-1280 有 2px 分隔线 #35302B，保留不盖）。
//   覆盖层 = 1080×1920 同色底 + 新 ASS → 裁 y1283–1920 → 复刻母版整帧淡入(0–0.6s)/淡出(末 0.9s)曲线 → overlay。
//   数学上与母版"字幕先烧、后整帧 fade"完全一致（(bg+字)×k），顶中栏像素零改动（PSNR 复检见 playback-check）。
// 渲染策略：**分块前台渲染**——整段一次性编码在本机实测 >50min 且被系统中断过一次（2026-11-06 01:20，
//   exit 137，staged 文件无 moov 报废）；改为 7×20s 块（块内 ASS 平移+裁剪）、各块独立编码，concat 流复制，
//   音轨从母版一次性直拷（不经历分块，零漂移）。用法：
//   SUB_ONLY=1 node …          只出 ASS/SRT（快，供目检）
//   CHUNKS=0,1,2 node …        只编码指定块（每块约 1-4 min，可分多次调用，抗中断）
//   ASSEMBLE=1 node …          concat + 音轨合成 + 覆盖母版 + summary（秒级）
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";

const DIR = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/家长短视频";
const SRC = `${DIR}/生态岛-家长口播-三栏样片-v4.mp4`;
const SRT = `${DIR}/生态岛-家长口播-三栏-v4.srt`;
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const FFPROBE = "H:/dev-env/ffmpeg/bin/ffprobe.exe";
const TMP = "G:/tempcache/f-cap/render";
const ENV = { ...process.env, TEMP: "G:/tempcache/f-cap", TMP: "G:/tempcache/f-cap", TMPDIR: "G:/tempcache/f-cap" };
mkdirSync(TMP, { recursive: true });
const run = (args, cwd) => {
  try { return execFileSync(FFMPEG, args, { env: ENV, cwd, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { throw new Error(`ffmpeg failed:\n${String(e.stderr ?? e).split("\n").slice(-12).join("\n")}`); }
};
const probe = (f, sel) => parseFloat(execFileSync(FFPROBE, ["-v", "error", ...(sel ? ["-select_streams", sel] : []), "-show_entries", sel ? "stream=duration" : "format=duration", "-of", "csv=p=0", f], { encoding: "utf8", env: ENV }).trim());

// ---------- 1) 解析并校验母版 SRT（逐句 wav 实测时间轴的块式切分） ----------
const srtRaw = readFileSync(SRT, "utf8").replace(/^\uFEFF/, "");
const toSec = (t) => { const [h, m, s] = t.split(":"); return +h * 3600 + +m * 60 + +s.replace(",", "."); };
const blocks = [];
for (const rec of srtRaw.trim().replace(/\r/g, "").split("\n\n")) {
  const [no, tm, ...ls] = rec.split("\n");
  const [a, b] = tm.split(" --> ").map(toSec);
  blocks.push({ idx: +no, start: a, end: b, a: tm.split(" --> ")[0], b: tm.split(" --> ")[1], lines: ls });
}
const chk = { n: blocks.length, minDur: 9, maxLine: 0, maxBlock: 0, overlap: 0, invert: 0 };
blocks.forEach((b, i) => {
  chk.minDur = Math.min(chk.minDur, b.end - b.start);
  chk.maxLine = Math.max(chk.maxLine, ...b.lines.map(l => l.length));
  chk.maxBlock = Math.max(chk.maxBlock, b.lines.join("").length);
  if (b.end <= b.start) chk.invert++;
  if (i && b.start < blocks[i - 1].end - 1e-9) chk.overlap++;
});
if (chk.invert || chk.overlap || chk.maxLine > 14 || chk.maxBlock > 20 || chk.minDur < 0.3)
  throw new Error(`SRT 校验不过: ${JSON.stringify(chk)}`);
console.log(`SRT 校验通过: ${JSON.stringify(chk)}`);

// ---------- 2) 大字报 ASS（底栏 y1280–1920 铺陈；错落三预设；概念词朱砂内嵌） ----------
const IVORY = "&H00D2E3EC", CINNABAR = "&H002B39C0"; // 暖象牙 #ECE3D2 / 朱砂 #C0392B（ASS 为 BGR）
const CONCEPTS = ["状态更新", "条件分支", "互相牵制", "限制因子", "承载力", "纯函数", "定时器"]; // 长词优先，每块至多一处
const PRESET = [ // 按块序号 i%3 轮换
  { name: "居中", an: 2, ml: 60, mr: 60, tw: 950 },   // tw=目标行宽(px)
  { name: "左置", an: 1, ml: 120, mr: 60, tw: 890 },  // 缩进 120、左对齐
  { name: "右置", an: 3, ml: 60, mr: 120, tw: 890 },  // 缩进 120、右对齐
];
const wch = (ch) => (/[\x00-\x7F]/.test(ch) ? (/[\s\-.:;'"()]/.test(ch) ? 0.34 : 0.58) : 1); // 半角≈0.58em
const wlen = (s, big = null) => [...s].reduce((a, ch) => a + (big && big.includes(ch) ? 1.32 : wch(ch)), 0);
const fmtAss = (t) => { // H:MM:SS.cc（本机 libass 对 2 位小时+3 位小数时间戳会静默错乱，见 v4 台账 bug①）
  const cc = Math.round(t * 100);
  const h = Math.floor(cc / 360000), m = Math.floor((cc % 360000) / 6000), s = Math.floor((cc % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cc % 100).padStart(2, "0")}`;
};
const events = [], plan = [];
blocks.forEach((b, bi) => {
  const r = PRESET[bi % 3];
  // 概念词定位（每块至多一处：两行中最早出现者）
  let hit = null;
  for (let li = 0; li < b.lines.length; li++) for (const c of CONCEPTS) {
    const p = b.lines[li].indexOf(c);
    if (p >= 0 && (!hit || p < hit.pos)) hit = { li, pos: p, word: c };
  }
  // 字号随块长自适应（含概念词 1.32 放大占宽），目标铺满栏宽
  const wOf = (l, i) => wlen(l, hit && hit.li === i ? hit.word : null);
  const Lmax = Math.max(...b.lines.map((l, i) => wOf(l, i)));
  const capMax = b.lines.length > 1 ? 106 : 124, capMin = b.lines.length > 1 ? 62 : 66; // 双行略小、仍是大字量级
  const fs = Math.max(capMin, Math.min(capMax, Math.floor(r.tw / Lmax)));
  const fBig = Math.round(fs * 1.32);
  const mk = (l, li) => {
    let t = l;
    if (hit && hit.li === li) t = t.replace(hit.word, `{\\fs${fBig}\\c${CINNABAR}}${hit.word}{\\fs${fs}\\c${IVORY}}`);
    return `{\\an${r.an}\\fs${fs}\\c${IVORY}}${t}`;
  };
  const rec = { block: bi + 1, preset: r.name, fs, lines: b.lines, concept: hit?.word ?? null, start: b.a, end: b.b };
  if (b.lines.length === 1) {
    const mv = Math.round(318 - 0.60 * fs); // 单行：块重心≈栏中(y≈1600)
    events.push({ a: b.start, b: b.end, ml: r.ml, mr: r.mr, mv, body: mk(b.lines[0], 0) });
    rec.margins = `ML${r.ml}/MR${r.mr}/MV${mv}`;
  } else {
    const off = bi % 2 === 0 ? 16 : -16;      // 双行第二行 ±16px 错位，方向随块奇偶
    const mv2 = Math.round(318 - 1.26 * fs);  // 下行 MarginV
    const mv1 = mv2 + Math.round(1.42 * fs);  // 上行在其上（YaHei 行高≈1.32em，留缝）
    const ml2 = r.an === 1 ? r.ml + off : r.an === 2 ? r.ml + off : r.ml;
    const mr2 = r.an === 3 ? r.mr + off : r.an === 2 ? r.mr - off : r.mr;
    events.push({ a: b.start, b: b.end, ml: r.ml, mr: r.mr, mv: mv1, body: mk(b.lines[0], 0) });
    events.push({ a: b.start, b: b.end, ml: ml2, mr: mr2, mv: mv2, body: mk(b.lines[1], 1) });
    rec.margins = `L1 MV${mv1} / L2 ML${ml2}/MR${mr2}/MV${mv2} (off=${off}px)`;
  }
  plan.push(rec);
});
const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Microsoft YaHei,100,&H00D2E3EC,&H00D2E3EC,&H001B1F24,&H5A000000,1,0,0,0,100,100,0,0,1,3,0,2,60,60,250,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
const emitAss = (evs) => assHeader + evs.map(e => `Dialogue: 0,${fmtAss(e.a)},${fmtAss(e.b)},Sub,,${e.ml},${e.mr},${e.mv},,${e.body}`).join("\n") + "\n";
writeFileSync(`${TMP}/parent-v4-sub.ass`, "\uFEFF" + emitAss(events), "utf8"); // 全片版（SUB_ONLY 目检/文档用）

// SRT 重出（时间轴与切分实测复用，逐字同源；UTF-8 BOM）
writeFileSync(SRT, "\uFEFF" + blocks.map((b, i) => `${i + 1}\n${b.a} --> ${b.b}\n${b.lines.join("\n")}\n`).join("\n"), "utf8");

// ---------- 3) 底栏覆盖合成：分块渲染 → concat 流复制 → 音轨一次直拷 ----------
const aDur = probe(SRC, "a:0");           // 132.38（=母版 cursor，fade 基准）
const FADE_OUT_ST = aDur - 0.9, FPS = 30;
const CHUNK = 20, NC = Math.ceil(aDur / CHUNK); // 7 块（末块 12.367s）
const framesTotal = Math.round(aDur * FPS);     // 3971，与母版一致

const assFor = (c0, c1) => { // 块内 ASS：事件平移到块内时间并裁出窗口
  const evs = [];
  for (const e of events) {
    if (e.b <= c0 || e.a >= c1) continue;
    evs.push({ ...e, a: Math.max(e.a, c0) - c0, b: Math.min(e.b, c1) - c0 });
  }
  return emitAss(evs);
};
const doChunk = (ci) => {
  const c0 = ci * CHUNK;
  const fr = Math.min(framesTotal - Math.round(c0 * FPS), CHUNK * FPS); // 末块对齐总帧数 3971
  const cd = fr / FPS;
  writeFileSync(`${TMP}/chunk-${ci}.ass`, "\uFEFF" + assFor(c0, c0 + cd), "utf8");
  const fades = ci === 0 ? `fade=t=in:st=0:d=0.6,` : ci === NC - 1 ? `fade=t=out:st=${(FADE_OUT_ST - c0).toFixed(3)}:d=0.9,` : "";
  run(["-y",
    "-ss", c0.toFixed(3), "-t", cd.toFixed(3), "-i", SRC,
    "-f", "lavfi", "-i", `color=c=0x241F1B:s=1080x1920:r=30:d=${cd.toFixed(3)}`, // 有限长：防 overlay eof_action=repeat 无限合成
    "-filter_complex",
    `[1:v]ass=chunk-${ci}.ass,crop=1080:637:0:1283,${fades}format=yuv420p[lay];` +
    `[0:v][lay]overlay=0:1283,format=yuv420p[v]`,
    "-map", "[v]", "-an",
    "-c:v", "libx264", "-preset", "veryfast", "-b:v", "2000k", "-maxrate", "3000k", "-bufsize", "4800k",
    "-pix_fmt", "yuv420p", "-r", "30",
    "-frames:v", String(fr), // 精确帧数（总帧数=母版 3971，音画差 0.00s；-t 会因四舍五入多取 1 帧）
    `${TMP}/chunk-${ci}.mp4`], TMP);
  const d = probe(`${TMP}/chunk-${ci}.mp4`);
  console.log(`chunk ${ci}: [${c0.toFixed(2)}→${(c0 + cd).toFixed(2)})s dur=${d.toFixed(3)} frames=${fr}`);
};
const assemble = () => {
  writeFileSync(`${TMP}/v-list.txt`, Array.from({ length: NC }, (_, i) => `file 'chunk-${i}.mp4'`).join("\n"));
  const STAGED = `${TMP}/v4-sub.mp4`;
  run(["-y", "-f", "concat", "-safe", "0", "-i", "v-list.txt",   // 视频流复制拼接
    "-i", SRC, "-map", "0:v", "-map", "1:a", "-c:a", "copy",     // 音轨从母版一次直拷（不分块，零漂移）
    "-movflags", "+faststart", STAGED], TMP);
  copyFileSync(STAGED, SRC); // 旧渲染版已先转存 存档/
};

if (process.env.SUB_ONLY) {
  console.log("SUB_ONLY: ASS/SRT 已出，跳过渲染");
} else if (process.env.CHUNKS) {
  for (const ci of process.env.CHUNKS.split(",").map(Number)) doChunk(ci);
} else if (process.env.ASSEMBLE) {
  const missing = Array.from({ length: NC }, (_, i) => `${TMP}/chunk-${i}.mp4`).filter(f => !existsSync(f));
  if (missing.length) throw new Error("缺块: " + missing.join(","));
  assemble();
  const vDur = probe(SRC);
  const fsList = plan.map(p => p.fs);
  const summary = {
    vDur: +vDur.toFixed(2), aDur, frames: framesTotal, blocks: chk.n, events: events.length,
    bar: "y1283–1920 覆盖（保留 y1279-1280 分隔线）；层=同色底+ASS，复刻母版 fade(in 0–0.6s/out 末0.9s)",
    render: `分块渲染 ${NC}×≤20s（veryfast，-b:v 2000k/max 3000k 码率封顶，块内 ASS 平移；crf 控不住二代编码噪点熵，chunk 实测 25Mbps 故改码率封顶）→ concat 流复制 → 音轨母版直拷`,
    fs: { min: Math.min(...fsList), max: Math.max(...fsList), note: "单行 cap124/双行 cap106，随块长自适应铺栏宽" },
    presets: { 居中: plan.filter(p => p.preset === "居中").length, 左置: plan.filter(p => p.preset === "左置").length, 右置: plan.filter(p => p.preset === "右置").length },
    concepts: plan.filter(p => p.concept).map(p => ({ block: p.block, word: p.concept, t: p.start })),
    srtCheck: chk,
    first3: plan.slice(0, 3),
  };
  writeFileSync(`${TMP}/subtitle-render-v4-summary.json`, JSON.stringify(summary, null, 1));
  writeFileSync("G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/sources/工程脚本/subtitle-render-v4-summary.json", JSON.stringify(summary, null, 1));
  console.log(`final: ${SRC}`);
  console.log(`video=${vDur.toFixed(3)}s audio=${aDur}s frames=${framesTotal} blocks=${chk.n} fs=${summary.fs.min}-${summary.fs.max} presets=${JSON.stringify(summary.presets)} concepts=${summary.concepts.length}`);
  console.log("done");
} else {
  console.log("用法：SUB_ONLY=1 | CHUNKS=0,1,… | ASSEMBLE=1（见文件头注释）");
}
