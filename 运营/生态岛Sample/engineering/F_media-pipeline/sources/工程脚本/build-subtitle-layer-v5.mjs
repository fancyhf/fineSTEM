// 家长口播三栏样片 v5 · 底栏字幕层第二轮微调（2026-11-06，用户看 v4 后两点反馈：
//   ①"字幕字号还是小"（截图：块5"草、小动物、水，三个数字决定小岛的命运。"双行小字）
//   ②"位置太偏底部——字幕挤在底栏下部，要抬高"）
//
// 定位：build-subtitle-layer-v4.mjs（第一轮大字报，2026-11-06）之后的**第二轮字幕层工序**。
//   母版（build-parent-post-v4.mjs）与第一轮的顶中栏、音频、剪辑零改动；本脚本只重做底栏 y1283–1920 覆盖层
//   （同色底 #241F1B 盖掉 v4 烧入字幕，再烧 v5 大字——与 v4 覆盖母版同一数学：层复刻整帧 fade 曲线）。
//
// ===== v4 → v5 参数对照（用户指令 + 实测标定）=====
//   1. 字号下限：单行 66 → **96**，双行 62 → **88**（用户指定，ASS 参数口径，与 v4 的 66/62 同一口径）
//   2. 字号上限：单行 124 / 双行 106 → **150**（单双行同上限；用户"常见块落在 110–150px"）
//   3. 行宽：目标行宽 居中 950 / 左右置 890 → **988 / 898**（=物理上限 1020/930 再减 32px 双行 ±16 错位余量；
//      物理口径=栏宽 1080 两侧各留 ≥30px 边，用户"行宽上限可到 1020px"）
//   4. 断行（"宁可换行也要大"）：原切分字号 <110 时重排行内断行——候选=原切分+标点断行（保留行尾标点）+
//      均衡断行（词内断行仅在无标点可用时出现）；择优序=字号档位(≥150/≥110/其余) → 标点行尾 → 行宽均衡 →
//      行首禁字(的了着呢吧吗啊，。、；：！？字) → 原切分优先。行≤14、块≤20、块文本与时间轴逐字不变。
//   5. 位置：块字形 bbox 视觉中心 → **y1600 = 底栏(1280–1920)正中**（用户指定；v4 实测重心 1600–1617 但字号小）。
//      MarginV 按实测线性模型反推：单行 mv=320−0.47fs、双行 mv2=320−1.19fs（行距 mv1=mv2+1.42fs 沿用 v4）。
//      双行块顶自然落在 y≈1437–1467（用户目标带 1420–1460）；块底 ≤1780；另设钳制：块顶≥1420（概念词放大
//      上探时生效）、块底≤1900（红线）。三种版式（居中/左置/右置）同样抬高。
//   6. **实测标定（v4 帧 bbox 7 例拟合，本轮新增）**：本机 libass + 微软雅黑的实渲染字面 em = **0.7466 × ASS fs**
//      （=upem2048 / hhea(asc2167+desc576)=2743）。v4 未做此补偿：fs 参数 66–124 实际只出字 49–93px——这是
//      "还是小"的根因之一。v5 的行宽/字号换算与 MarginV 模型全部按实测系数标定（拟合残差 ≤2px）。
//   7. 其余全部不动：三预设轮换（居中/左置缩进120/右置缩进120）、双行第二行 ±16px 错位（方向随块奇偶）、
//      概念词朱砂内嵌（×1.32、每块至多一处、同屏仅一处）、块式切分时间轴（逐句 wav 实测，复用 v4 SRT）、
//      旁白音频直拷、顶栏/中栏、剪辑、分块渲染→concat 流复制→fade 复刻管线。
//
// 输入：存档的 v4 成片与 SRT（运行前 v4 已转存 存档/——v4 底栏字幕被本层完全覆盖，无残留）
// 输出：家长短视频/生态岛-家长口播-三栏样片-v5.mp4 + 生态岛-家长口播-三栏-v5.srt（UTF-8 BOM，断行=画面实际断行）
// 渲染策略（沿 v4）：SUB_ONLY=1 只出 ASS/SRT 干跑校验；CHUNKS=0,1,… 分块编码；ASSEMBLE=1 concat+音轨直拷+summary。
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const DIR = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/家长短视频";
const SRC = `${DIR}/存档/生态岛-家长口播-三栏样片-v4-大字报字幕层.mp4`; // v4 现行成片（音画基准，底栏将被覆盖）
const SRT_IN = `${DIR}/存档/生态岛-家长口播-三栏-v4.srt`;               // 块式切分+实测时间轴（逐字复用）
const OUT = `${DIR}/生态岛-家长口播-三栏样片-v5.mp4`;
const SRT_OUT = `${DIR}/生态岛-家长口播-三栏-v5.srt`;
const SUMMARY_PATH = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/sources/工程脚本/subtitle-render-v5-summary.json";
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const FFPROBE = "H:/dev-env/ffmpeg/bin/ffprobe.exe";
const TMP = "G:/tempcache/f-cap2/render";
const ENV = { ...process.env, TEMP: "G:/tempcache/f-cap2", TMP: "G:/tempcache/f-cap2", TMPDIR: "G:/tempcache/f-cap2" };
mkdirSync(TMP, { recursive: true });
const run = (args, cwd) => {
  try { return execFileSync(FFMPEG, args, { env: ENV, cwd, stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { throw new Error(`ffmpeg failed:\n${String(e.stderr ?? e).split("\n").slice(-12).join("\n")}`); }
};
const probe = (f, sel) => parseFloat(execFileSync(FFPROBE, ["-v", "error", ...(sel ? ["-select_streams", sel] : []), "-show_entries", sel ? "stream=duration" : "format=duration", "-of", "csv=p=0", f], { encoding: "utf8", env: ENV }).trim());

// ---------- 1) 解析并校验 v4 SRT（块式切分实测时间轴，逐字复用） ----------
const srtRaw = readFileSync(SRT_IN, "utf8").replace(/^\uFEFF/, "");
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

// ---------- 2) v5 大字报排版（实测标定 + 下限 96/88 + 上限 150 + 中心 y1600） ----------
const EM = 2048 / 2743;              // 0.74663：实渲染字面 em(px) = EM × ASS fs（v4 帧 bbox 实测标定，见文件头⑥）
const CAP = 150, FLOOR = { 1: 96, 2: 88 }, BAND = 110;   // 用户指定：下限 96/88、常见带 110–150、上限 150
const IVORY = "&H00D2E3EC", CINNABAR = "&H002B39C0";     // 暖象牙 #ECE3D2 / 朱砂 #C0392B（ASS 为 BGR）
const CONCEPTS = ["状态更新", "条件分支", "互相牵制", "限制因子", "承载力", "纯函数", "定时器"];
const PRESET = [ // 按块序号 i%3 轮换（沿 v4）；tw=行宽预算(px)=物理上限(1020/930)−32(±16错位余量)
  { name: "居中", an: 2, ml: 60, mr: 60, tw: 988 },
  { name: "左置", an: 1, ml: 120, mr: 60, tw: 898 },
  { name: "右置", an: 3, ml: 60, mr: 120, tw: 898 },
];
const PUNCT = "，。：、；？！";                 // 断行候选的行尾标点（沿规范"按标点断短语"）
const GUARD2 = "的了着呢吧吗啊，。、；：！？字"; // 均衡断行的行首禁字（防"字/的"开头；全部禁尽时回退忽略）
const wch = (ch) => (/[\x00-\x7F]/.test(ch) ? (/[\s\-.:;'"()]/.test(ch) ? 0.34 : 0.58) : 1); // 半角≈0.58em（保守）
const wlen = (s, big = null) => [...s].reduce((a, ch) => a + (big && big.includes(ch) ? 1.32 : wch(ch)), 0);
const fmtAss = (t) => { // H:MM:SS.cc（本机 libass 对 2 位小时+3 位小数时间戳会静默错乱，见 v4 台账 bug①）
  const cc = Math.round(t * 100);
  const h = Math.floor(cc / 360000), m = Math.floor((cc % 360000) / 6000), s = Math.floor((cc % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cc % 100).padStart(2, "0")}`;
};

// 候选断行生成：原切分 + 全部标点断点 + 半宽附近 ±2 的均衡断点（跳过数字贴邻断点，防"第47步"被拆）
function candidates(lines) {
  const t = lines.join("");
  const list = [{ lines, kind: "原切分", i: -1 }];
  for (let i = 0; i < t.length - 1; i++)
    if (PUNCT.includes(t[i])) list.push({ lines: [t.slice(0, i + 1), t.slice(i + 1)], kind: "标点", i });
  const half = t.length / 2;
  for (let i = Math.max(1, Math.ceil(half) - 2); i <= Math.min(t.length - 1, Math.floor(half) + 2); i++) {
    if (/\d/.test(t[i - 1]) || /\d/.test(t[i])) continue;
    list.push({ lines: [t.slice(0, i), t.slice(i)], kind: "均衡", i });
  }
  return list;
}
// 概念词定位（每块至多一处：两行中最早出现者；跨行断开的候选直接淘汰）
function findConcept(candLines) {
  let hit = null;
  for (let li = 0; li < candLines.length; li++) for (const c of CONCEPTS) {
    const p = candLines[li].indexOf(c);
    if (p >= 0 && (!hit || p < hit.pos)) hit = { li, pos: p, word: c };
  }
  return hit;
}
const conceptIntact = (candLines) => {
  const t = candLines.join("");
  return CONCEPTS.filter(c => t.includes(c)).every(c => candLines.some(l => l.includes(c)));
};

const events = [], plan = [];
blocks.forEach((b, bi) => {
  const r = PRESET[bi % 3];
  // --- 择伤断行：字号档位 → 标点行尾 → 行宽均衡 → 行首禁字 → 原切分优先 ---
  const cands = candidates(b.lines).map(c => {
    const hit = findConcept(c.lines);
    const Lmax = Math.max(...c.lines.map((l, li) => wlen(l, hit && hit.li === li ? hit.word : null)));
    const fs = Math.min(CAP, Math.floor(r.tw / (Lmax * EM)));   // 标定换算：字面宽 = wlen × EM × fs
    const floor = FLOOR[c.lines.length];
    const okLine = c.lines.every(l => [...l].length <= 14);
    const okConcept = conceptIntact(c.lines);
    const guard2 = c.lines.length < 2 || !GUARD2.includes(c.lines[1][0]);
    const imb = c.lines.length < 2 ? 0 : Math.abs(wlen(c.lines[0]) - wlen(c.lines[1]));
    const bonus = c.lines.length === 1 ? (PUNCT.includes([...c.lines[0]].pop() ?? "") ? 1 : 0)
      : (PUNCT.includes([...c.lines[0]].pop() ?? "") ? 1 : 0);
    const kindRank = { 原切分: 2, 标点: 1, 均衡: 0 }[c.kind];
    return { ...c, hit, Lmax, fs, valid: fs >= floor && okLine && okConcept, imb, bonus, guard2, kindRank };
  });
  const good = cands.filter(c => c.valid);
  if (!good.length) throw new Error(`块${bi + 1}无合法断行`);
  const pick = [...good].sort((x, y) =>
    (Math.min(y.fs, CAP) >= CAP ? 3 : y.fs >= BAND ? 2 : 1) - (Math.min(x.fs, CAP) >= CAP ? 3 : x.fs >= BAND ? 2 : 1)
    || y.bonus - x.bonus || (y.guard2 ? 1 : 0) - (x.guard2 ? 1 : 0) || x.imb - y.imb || y.kindRank - x.kindRank || x.i - y.i
  )[0];
  const { lines, hit, fs } = pick;

  // --- MarginV：视觉中心(字形 bbox 中点) = y1600（实测线性模型，见文件头⑤）；钳制顶≥1420/底≤1900 ---
  const E = EM * fs;
  const fBig = Math.round(fs * 1.32);
  const mk = (l, li) => {
    let t = l;
    if (hit && hit.li === li) t = t.replace(hit.word, `{\\fs${fBig}\\c${CINNABAR}}${hit.word}{\\fs${fs}\\c${IVORY}}`);
    return `{\\an${r.an}\\fs${fs}\\c${IVORY}}${t}`;
  };
  const rec = { block: bi + 1, preset: r.name, fs, kind: pick.kind, lines, concept: hit?.word ?? null, start: b.a, end: b.b };
  const topK = (liBig) => 1.14 * (liBig ? 1.32 : 1) * E;   // 行字形顶 = 行名义底 − topK（实测；概念行 ×1.32 上探）
  const botK = (liBig) => 0.1045 * fs * (liBig ? 1.32 : 1); // 行字形底 = 行名义底 − botK
  if (lines.length === 1) {
    let mv = Math.round(320 - 0.47 * fs);
    const big = !!hit; // 单行含概念词时字形顶上探
    let top = 1920 - mv - topK(big), bot = 1920 - mv - botK(big);
    if (top < 1420) { mv -= Math.round(1420 - top); top = 1420; } // 块顶过高→整块下移=mv 减小（MarginV 自底向上量）
    if (bot > 1900) { mv += Math.round(bot - 1900); bot = 1900; }
    events.push({ a: b.start, b: b.end, ml: r.ml, mr: r.mr, mv, body: mk(lines[0], 0) });
    rec.geo = `单行 fs${fs} mv${mv} 顶${Math.round(top)} 底${Math.round(bot)}`;
    rec.margins = `ML${r.ml}/MR${r.mr}/MV${mv}`;
  } else {
    const off = bi % 2 === 0 ? 16 : -16;      // 双行第二行 ±16px 错位，方向随块奇偶（沿 v4）
    let mv2 = Math.round(320 - 1.19 * fs);
    let mv1 = mv2 + Math.round(1.42 * fs);
    let top = 1920 - mv1 - topK(hit && hit.li === 0), bot = 1920 - mv2 - botK(hit && hit.li === 1);
    if (top < 1420) { const d = Math.round(1420 - top); mv2 -= d; mv1 -= d; top += d; bot += d; } // 下移=mv 减小
    if (bot > 1900) { const d = Math.round(bot - 1900); mv2 += d; mv1 += d; top -= d; bot -= d; } // 上移=mv 增大
    const ml2 = r.an === 1 ? r.ml + off : r.an === 2 ? r.ml + off : r.ml;
    const mr2 = r.an === 3 ? r.mr + off : r.an === 2 ? r.mr - off : r.mr;
    events.push({ a: b.start, b: b.end, ml: r.ml, mr: r.mr, mv: mv1, body: mk(lines[0], 0) });
    events.push({ a: b.start, b: b.end, ml: ml2, mr: mr2, mv: mv2, body: mk(lines[1], 1) });
    rec.geo = `双行 fs${fs} mv1${mv1}/mv2${mv2} 顶${Math.round(top)} 底${Math.round(bot)}`;
    rec.margins = `L1 MV${mv1} / L2 ML${ml2}/MR${mr2}/MV${mv2} (off=${off}px)`;
  }
  // 行宽硬校验（含概念词放大）
  lines.forEach((l, li) => {
    const w = wlen(l, hit && hit.li === li ? hit.word : null) * EM * fs;
    if (w > r.tw + 0.5) throw new Error(`块${bi + 1}行${li + 1}宽 ${w.toFixed(0)}px 超预算 ${r.tw}`);
    rec[`w${li + 1}`] = Math.round(w);
  });
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
writeFileSync(`${TMP}/parent-v5-sub.ass`, "\uFEFF" + emitAss(events), "utf8"); // 全片版（SUB_ONLY 目检/文档用）

// SRT 重出（时间轴与块文本逐字同源；断行=画面实际断行；UTF-8 BOM）
writeFileSync(SRT_OUT, "\uFEFF" + plan.map((p, i) => `${i + 1}\n${p.start} --> ${p.end}\n${p.lines.join("\n")}\n`).join("\n"), "utf8");

// 干跑报表
const fsList = plan.map(p => p.fs);
console.log("块  版式  字号  断行  行宽  几何  文本");
plan.forEach(p => console.log(`${String(p.block).padStart(2)}  ${p.preset}  fs${p.fs}  ${p.kind}  ${p.w1}${p.w2 ? "+" + p.w2 : ""}px  ${p.geo}  ${p.lines.join(" / ")}${p.concept ? "  【" + p.concept + "】" : ""}`));
console.log(`fs 分布: min=${Math.min(...fsList)} max=${Math.max(...fsList)}；<110 的块: ${plan.filter(p => p.fs < 110).map(p => p.block).join(",") || "无"}`);
console.log(`断行改动块: ${plan.filter(p => p.kind !== "原切分").map(p => p.block).join(",") || "无"}；概念词: ${plan.filter(p => p.concept).length} 处`);

// ---------- 3) 底栏覆盖合成：分块渲染 → concat 流复制 → 音轨一次直拷（沿 v4 管线） ----------
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
    "-frames:v", String(fr), // 精确帧数（总帧数=母版 3971，音画差 0.00s）
    `${TMP}/chunk-${ci}.mp4`], TMP);
  const d = probe(`${TMP}/chunk-${ci}.mp4`);
  console.log(`chunk ${ci}: [${c0.toFixed(2)}→${(c0 + cd).toFixed(2)})s dur=${d.toFixed(3)} frames=${fr}`);
};
const assemble = () => {
  writeFileSync(`${TMP}/v-list.txt`, Array.from({ length: NC }, (_, i) => `file 'chunk-${i}.mp4'`).join("\n"));
  const STAGED = `${TMP}/v5-sub.mp4`;
  run(["-y", "-f", "concat", "-safe", "0", "-i", "v-list.txt",   // 视频流复制拼接
    "-i", SRC, "-map", "0:v", "-map", "1:a", "-c:a", "copy",     // 音轨从 v4 一次直拷（不分块，零漂移零重编码）
    "-movflags", "+faststart", STAGED], TMP);
  execFileSync("node", ["-e", `require("fs").copyFileSync(${JSON.stringify(STAGED)}, ${JSON.stringify(OUT)})`]);
  const vDur = probe(OUT);
  const summary = {
    vDur: +vDur.toFixed(2), aDur, frames: framesTotal, blocks: chk.n, events: events.length,
    bar: "y1283–1920 覆盖（保留 y1279-1280 分隔线）；层=同色底+ASS，复刻母版 fade(in 0–0.6s/out 末0.9s)；v4 烧入字幕被同色底完全覆盖",
    calibration: { emPerFs: +EM.toFixed(5), note: "实渲染字面em=0.74663×fs（YaHei upem2048/hhea2743，v4帧bbox 7例拟合，残差≤2px）；v4 未补偿致 fs66–124 实出字 49–93px" },
    render: `分块渲染 ${NC}×≤20s（veryfast，-b:v 2000k/max 3000k 码率封顶，块内 ASS 平移）→ concat 流复制 → 音轨 v4 直拷`,
    fs: { min: Math.min(...fsList), max: Math.max(...fsList), floor: "单行96/双行88", cap: CAP, note: "下限 96/88（v4:66/62）、上限 150（v4:124/106）、目标行宽 988/898（含 ±16 错位余量；物理边≥30px）" },
    geo: "块字形bbox视觉中心=y1600（底栏1280–1920正中）；单行mv=320−0.47fs、双行mv2=320−1.19fs、行距1.42fs沿v4；钳制顶≥1420/底≤1900；双行块顶实测模型≈1437–1467",
    presets: { 居中: plan.filter(p => p.preset === "居中").length, 左置: plan.filter(p => p.preset === "左置").length, 右置: plan.filter(p => p.preset === "右置").length },
    rewrap: plan.filter(p => p.kind !== "原切分").map(p => ({ block: p.block, kind: p.kind, lines: p.lines })),
    concepts: plan.filter(p => p.concept).map(p => ({ block: p.block, word: p.concept, t: p.start })),
    srtCheck: chk,
    plan,
  };
  writeFileSync(`${TMP}/subtitle-render-v5-summary.json`, JSON.stringify(summary, null, 1));
  writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 1));
  console.log(`final: ${OUT}`);
  console.log(`video=${vDur.toFixed(3)}s audio=${aDur}s frames=${framesTotal} blocks=${chk.n} fs=${summary.fs.min}-${summary.fs.max} presets=${JSON.stringify(summary.presets)} concepts=${summary.concepts.length}`);
  console.log("done");
};

if (process.env.SUB_ONLY) {
  console.log("SUB_ONLY: ASS/SRT 已出，跳过渲染");
} else if (process.env.CHUNKS) {
  for (const ci of process.env.CHUNKS.split(",").map(Number)) doChunk(ci);
} else if (process.env.ASSEMBLE) {
  const missing = Array.from({ length: NC }, (_, i) => `${TMP}/chunk-${i}.mp4`).filter(f => !existsSync(f));
  if (missing.length) throw new Error("缺块: " + missing.join(","));
  assemble();
} else {
  console.log("用法：SUB_ONLY=1 | CHUNKS=0,1,… | ASSEMBLE=1（见文件头注释）");
}
