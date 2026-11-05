// 家长口播排片样片 v4：三栏式（顶栏节目名+声波线｜中栏演示面板【铺满中栏】｜底栏大字台词块）
// v4（2026-11-05）：只改 1 句口播文案（p12-2 五科贯通，见 parent-narration-v4.mjs），版式/卡片/剪辑参数与 v3 完全一致
// 版式按《家长播客_规范》§三/§八 + 《音频与字幕生产_规范》§四，含 2026-11-04 用户版式覆盖决策：
//   【覆盖决策】中栏演示画面不再受"≤栏内一半"约束——按用户反馈改为铺满中栏：
//   面板 1080×592 @ (0,664)（宽=全幅；高=640−上下小边距 24px×2；比例不合则等比放大居中裁切）。
//   其余维持 v2：1080×1920 三栏等高；底栏字幕块式（行≤14、块≤20、错落三预设轮换、双行 ±16px 错位、
//   概念词朱砂内嵌同屏一处）；配色 暖深炭 #241F1B / 暖象牙 #ECE3D2 / 赭石金 #C9A24B，朱砂只出现在字幕概念词。
// 开场（镜 1-3）：镜 1 中栏=开场小岛卡（reference 儿童版第 0 步渲染帧，小岛全景+三个数字）；
//   镜 2=M6 三个数字卡；镜 3=M2 作品实录——开局即"一眼看到小岛"（2026-11-04 用户反馈）。
// 声波线：showwaves 直接由成片音轨生成（绑定音频，广播感）。配音：芳姐声 S_VgvqqDYd2（TTS 实测时长驱动，
//   未变句复用 v2 wav，变句重生成——见 parent-narration-v3.mjs）。
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";

const TMP = "G:/tempcache/e-rev2/post-parent-v4";
const BASE = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/sources/排片样片素材/三栏底版.png";
const CARDS = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/家长短视频/信息卡";
const M2 = "G:/tempcache/f-pkg/m2";
const TIMELINE = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/sources/工程脚本/parent-timeline-v4.json";
const OUTDIR = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/家长短视频";
const FINAL = `${OUTDIR}/生态岛-家长口播-三栏样片-v4.mp4`;
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const ENV = { ...process.env, TEMP: "G:/tempcache/e-rev2", TMP: "G:/tempcache/e-rev2", TMPDIR: "G:/tempcache/e-rev2" };
const GAP = 0.3, LEAD = 0.45, TAIL = 0.7;

mkdirSync(TMP, { recursive: true });
const run = (args) => execFileSync(FFMPEG, args, { env: ENV, stdio: ["ignore", "pipe", "pipe"] });
const runC = (args, cwd) => execFileSync(FFMPEG, args, { env: ENV, cwd, stdio: ["ignore", "pipe", "pipe"] });
const probe = (f) => parseFloat(execFileSync(FFMPEG.replace("ffmpeg.exe", "ffprobe.exe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8", env: ENV }).trim());
const silence = (sec, file) => run(["-y", "-f", "lavfi", "-t", Math.max(0.05, sec).toFixed(3), "-i", "anullsrc=r=24000:cl=mono", "-c:a", "pcm_s16le", file]);

// ---------- 0) 逐句静音修剪（wav 真值；不加快语速） ----------
const timeline = JSON.parse(readFileSync(TIMELINE, "utf8"));
const trimmed = {};
for (const shot of timeline) for (const s of shot.sentences) {
  if (s.deleted) continue;
  const outW = s.wav.replace(".wav", "-trim.wav");
  if (!trimmed[s.wav]) {
    run(["-y", "-i", s.wav, "-af",
      "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.10,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.10,areverse",
      "-c:a", "pcm_s16le", outW]);
    trimmed[s.wav] = { wav: outW, dur: probe(outW) };
  }
}
const T = (s) => trimmed[s.wav];

// ---------- 1) 分段计划：type card=中栏信息卡/画面 | clip=中栏作品实录（全段有画面，含开场镜） ----------
// 中栏面板铺满：1080×592 @ (0,664)——中栏 640–1280，上下各留 24px 小边距（用户版式覆盖决策，见文件头）
const CLIP_WINDOW = { p3: { src: `${M2}/m2-take.mp4`, from: 2.0 }, p4: { src: `${M2}/m2-take.mp4`, from: 5.6 } };
const plan = [
  { id: "s01", seg: "p1", panel: { card: `${CARDS}/中栏版-开场小岛.png`, first: true } },
  { id: "s02", seg: "p2", panel: { card: `${CARDS}/中栏版-M6-三个数字.png` } },
  { id: "s03", seg: "p3", panel: { clip: CLIP_WINDOW.p3 } },
  { id: "s04", seg: "p4", panel: { clip: CLIP_WINDOW.p4 } },
  { id: "s05", seg: "p5", panel: { card: `${CARDS}/中栏版-M7-手算竖式.png` } },
  { id: "s06", seg: "p6", panel: { card: `${CARDS}/中栏版-M4-对照卡.png` } },
  { id: "s07", seg: "p7", panel: { card: `${CARDS}/中栏版-M5a-三档与最短板.png` } },
  { id: "s08", seg: "p8", panel: { card: `${CARDS}/中栏版-M5b-圣马太岛.png` } },
  { id: "s09", seg: "p9", panel: { card: `${CARDS}/中栏版-M10-多结局卡.png` } },
  { id: "s10", seg: "p10", panel: { card: `${CARDS}/中栏版-M8-边界卡.png` } },
  { id: "s11", seg: "p11", panel: { card: `${CARDS}/中栏版-M9-产出卡.png` } },
  { id: "s12", seg: "p12", panel: { card: `${CARDS}/中栏版-落版.png` }, end: true },
];

// ---------- 2) 逐段时长 + 音轨 + 全局时间轴 ----------
let cursor = 0;
const segs = [];
const blocks = []; // 句级 {start,end,text}
for (const seg of plan) {
  const first = segs.length === 0;
  const lead = first ? 0.5 : LEAD, tail = seg.end ? 1.0 : TAIL;
  const sents = timeline.find(t => t.id === seg.seg).sentences.filter(s => !s.deleted);
  const durs = sents.map(T);
  const dur = lead + durs.reduce((a, d) => a + d.dur, 0) + GAP * (sents.length - 1) + tail;
  const parts = [];
  const sf = `${TMP}/${seg.id}-lead.wav`; silence(lead, sf); parts.push(sf);
  sents.forEach((w, i) => {
    parts.push(T(w).wav);
    blocks.push({ start: cursor + lead + durs.slice(0, i).reduce((a, d) => a + d.dur, 0) + GAP * i, end: cursor + lead + durs.slice(0, i + 1).reduce((a, d) => a + d.dur, 0) + GAP * i, text: w.display });
    if (i < sents.length - 1) { const g = `${TMP}/${seg.id}-gap${i}.wav`; silence(GAP, g); parts.push(g); }
  });
  const tf = `${TMP}/${seg.id}-tail.wav`; silence(tail, tf); parts.push(tf);
  const list = `${TMP}/${seg.id}-a.txt`;
  writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
  run(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", `${TMP}/${seg.id}-audio.wav`]);
  segs.push({ ...seg, dur, start: cursor });
  cursor += dur;
}
const speechTotal = blocks.reduce((a, b) => a + (b.end - b.start), 0);

// ---------- 3) 逐段视频：三栏底版 + 中栏面板【铺满】淡入淡出 ----------
const PW = 1080, PH = 592, PX = 0, PY = 664; // 面板铺满中栏（2026-11-04 用户版式覆盖决策）
for (const seg of segs) {
  const args = ["-y", "-loop", "1", "-t", seg.dur.toFixed(3), "-i", BASE];
  const fadeInSt = seg.panel.first ? 0.12 : 0.35, fadeInD = seg.panel.first ? 0.3 : 0.4;
  let filter;
  if (seg.panel?.card) {
    args.push("-loop", "1", "-t", seg.dur.toFixed(3), "-i", seg.panel.card);
    filter = `[1:v]scale=${PW}:608,crop=${PW}:${PH}:0:8,drawbox=c=0xC9A24B@0.55:t=4,` + // 卡面 1280×720 等比放大后居中裁 8px（上下各 ~4.7 设计px）
      `fade=t=in:st=${fadeInSt}:d=${fadeInD},fade=t=out:st=${(seg.dur - 0.6).toFixed(2)}:d=0.4,format=yuv420p[pane];` +
      `[0:v][pane]overlay=${PX}:${PY}:enable='between(t,${fadeInSt},${(seg.dur - 0.15).toFixed(2)})',format=yuv420p[v]`;
    args.push("-filter_complex", filter, "-map", "[v]");
  } else if (seg.panel?.clip) {
    const c = seg.panel.clip;
    const srcDur = probe(c.src);
    const clipDur = Math.min(seg.dur - 0.5, srcDur - c.from - 0.05);
    args.push("-ss", c.from.toFixed(2), "-t", clipDur.toFixed(2), "-i", c.src);
    filter = `[1:v]fps=30,crop=1180:647:330:89,scale=${PW}:${PH},drawbox=c=0xC9A24B@0.55:t=4,` + // 实录 1920×1080 按面板比例(1.824)重取景：与 v2 同内容窗，上下微收
      `fade=t=in:st=${fadeInSt}:d=${fadeInD},fade=t=out:st=${(clipDur - 0.4).toFixed(2)}:d=0.4,format=yuv420p[pane];` +
      `[0:v][pane]overlay=${PX}:${PY}:enable='between(t,${fadeInSt},${(fadeInSt + clipDur).toFixed(2)})',format=yuv420p[v]`;
    args.push("-filter_complex", filter, "-map", "[v]");
  } else {
    args.push("-vf", "format=yuv420p");
  }
  args.push("-t", seg.dur.toFixed(3), "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    `${TMP}/${seg.id}-video.mp4`);
  run(args);
  console.log(`seg ${seg.id} (${seg.seg}): ${seg.dur.toFixed(2)}s ${seg.panel ? (seg.panel.card ? seg.panel.card.split("/").pop() : "clip") : "面板收起"}`);
}

// ---------- 4) 字幕块式：行≤14、块≤20、错落三预设轮换、双行 ±16px 错位、概念词朱砂内嵌 ----------
function pack(sentence) {
  const tokens = []; let cur = "";
  for (const ch of sentence) { cur += ch; if ("，。？！；：、".includes(ch)) { tokens.push(cur); cur = ""; } }
  if (cur) tokens.push(cur);
  const blocksTxt = [];
  let lines = [""];
  for (const tk of tokens) {
    const l0 = lines[0] || "", l1 = lines[1] || "";
    if (lines[1] === undefined && (l0.length + tk.length) <= 14 && (l0.length + tk.length) <= 20) { lines[0] = l0 + tk; continue; }
    if (lines[1] === undefined && l0.length >= 1 && (l0.length + tk.length) <= 20) { lines[1] = tk; continue; } // 块≤20 封块
    if (lines[1] !== undefined && (l1.length + tk.length) <= 14 && (l0.length + l1.length + tk.length) <= 20) { lines[1] = l1 + tk; continue; }
    if (l0 || l1) blocksTxt.push({ lines: [l0, l1].filter(Boolean) });
    lines = [tk];
  }
  if (lines[0] || lines[1]) blocksTxt.push({ lines: [lines[0], lines[1]].filter(Boolean) });
  return blocksTxt;
}
const CONCEPT = "限制因子";
const subBlocks = [];
for (const b of blocks) {
  const packed = pack(b.text);
  const totalChars = packed.reduce((a, p) => a + p.lines.join("").length, 0);
  let t = b.start;
  for (const p of packed) {
    const share = p.lines.join("").length / totalChars;
    const d = Math.max(0.35, share * (b.end - b.start));
    subBlocks.push({ start: t, end: Math.min(b.end, t + d), lines: p.lines });
    t += d;
  }
}
const fmtTime = (t, comma = true) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (comma) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")},${String(Math.round((s - Math.floor(s)) * 1000)).padStart(3, "0")}`;
  // ASS：H:MM:SS.cc（本机 libass 对 3 位小数 + 2 位小时会静默丢事件）
  return `${h}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}.${String(Math.round((s - Math.floor(s)) * 100)).padStart(2, "0")}`;
};
writeFileSync(`${OUTDIR}/生态岛-家长口播-三栏-v4.srt`, "\uFEFF" + subBlocks.map((b, i) => `${i + 1}\n${fmtTime(b.start)} --> ${fmtTime(b.end)}\n${b.lines.join("\n")}\n`).join("\n"), "utf8");

// ASS：底栏（y1280–1920）大字台词铺满；错落三预设 轮换；双行拆两事件 ±16px 错位
const IVORY = "&H00D2E3EC", CINNABAR = "&H2B39C0"; // 朱砂 #C0392B（BGR）
const rot = [
  { a: 2, ml: 90, mr: 90 },   // 居中
  { a: 1, ml: 130, mr: 320 }, // 左置
  { a: 3, ml: 320, mr: 130 }, // 右置
];
const events = [];
subBlocks.forEach((b, i) => {
  const r = rot[i % 3];
  const fs = b.lines.length > 1 ? 52 : 64; // 字号随块长自适应（规范：双行 42–54、单行 44–68）
  const markup = (line) => line.includes(CONCEPT)
    ? line.replace(CONCEPT, `{\\fs${fs + 14}\\c${CINNABAR}}${CONCEPT}{\\fs${fs}\\c${IVORY}}`) // 概念词原地放大+朱砂（同屏仅此一处）
    : line;
  if (b.lines.length === 1) {
    events.push(`Dialogue: 0,${fmtTime(b.start, false)},${fmtTime(b.end, false)},Sub,,0,0,0,,{\\an${r.a}\\fs${fs}\\c${IVORY}}${markup(b.lines[0])}`);
  } else {
    // 双行：拆两个事件，水平错位 16px（规范：第二行 ±16px 错位）
    const off = 16;
    const lMargin = (isL1) => r.a === 1 ? r.ml + (isL1 ? off : 0) : r.a === 2 ? r.ml + (isL1 ? off : 0) : r.ml;
    const rMargin = (isL1) => r.a === 3 ? r.mr + (isL1 ? off : 0) : r.a === 2 ? r.mr + (isL1 ? off : 0) : r.mr;
    events.push(`Dialogue: 0,${fmtTime(b.start, false)},${fmtTime(b.end, false)},Sub,,${lMargin(true)},${rMargin(true)},${170 + Math.round(fs * 1.12)},,{\\an${r.a}\\fs${fs}\\c${IVORY}}${markup(b.lines[0])}`);
    events.push(`Dialogue: 0,${fmtTime(b.start, false)},${fmtTime(b.end, false)},Sub,,${lMargin(false)},${rMargin(false)},170,,{\\an${r.a}\\fs${fs}\\c${IVORY}}${markup(b.lines[1])}`);
  }
});
const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Microsoft YaHei,64,&H00D2E3EC,&H00D2E3EC,&H001B1F24,&H5A000000,1,0,0,0,100,100,0,0,1,2,0,2,90,90,170,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
writeFileSync(`${TMP}/parent-v4.ass`, "\uFEFF" + assHeader + events.join("\n") + "\n", "utf8");

// ---------- 5) 全轨 → 声波线 → 拼接 + 烧字幕 + 混音 ----------
writeFileSync(`${TMP}/a-list.txt`, segs.map(s => `file '${TMP}/${s.id}-audio.wav'`.replace(/\\\\/g, "/")).join("\n"));
run(["-y", "-f", "concat", "-safe", "0", "-i", `${TMP}/a-list.txt`, "-c:a", "pcm_s16le", `${TMP}/full-24k.wav`]);
run(["-y", "-i", `${TMP}/full-24k.wav`, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", `${TMP}/full-norm.wav`]);
const aDur = probe(`${TMP}/full-norm.wav`);
// 声波线（绑定音轨；赭石金；色键抠掉黑底露出声波槽底色）
// 本机 ffmpeg showwaves 的 hex 色值会静默回落默认色：先画 white，再 lutrgb 乘出赭石金 #C9A24B；draw=full 防停顿整帧黑
run(["-y", "-i", `${TMP}/full-norm.wav`, "-filter_complex",
  `[0:a]showwaves=s=1080x160:mode=cline:rate=30:colors=white:draw=full[w]`, "-map", "[w]",
  "-r", "30", "-t", aDur.toFixed(3), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", `${TMP}/waves-raw.mp4`]);
run(["-y", "-i", `${TMP}/waves-raw.mp4`, "-vf",
  "format=rgb24,lutrgb=r='val*201/255':g='val*162/255':b='val*75/255',colorkey=0x000000:0.06:0.03,format=yuv420p",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", `${TMP}/waves.mp4`]);

writeFileSync(`${TMP}/v-list.txt`, segs.map(s => `file '${TMP}/${s.id}-video.mp4'`).join("\n"));
runC(["-y",
  "-f", "concat", "-safe", "0", "-i", "v-list.txt",
  "-i", "waves.mp4",
  "-i", "full-norm.wav",
  "-filter_complex",
  `[0:v][1:v]overlay=0:464[v];` +
  `[v]ass=parent-v4.ass,fade=t=in:st=0:d=0.6,fade=t=out:st=${(cursor - 0.9).toFixed(2)}:d=0.9,format=yuv420p[out]`,
  "-map", "[out]", "-map", "2:a",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest",
  FINAL], TMP);
const vDur = probe(FINAL);
console.log(`final: ${FINAL}`);
console.log(`video=${vDur.toFixed(2)}s audio=${aDur.toFixed(2)}s blocks=${subBlocks.length} speech=${speechTotal.toFixed(1)}s`);
const summary = {
  vDur, aDur, blocks: subBlocks.length, speech: +speechTotal.toFixed(1),
  panel: { w: PW, h: PH, x: PX, y: PY, note: "铺满中栏（2026-11-04 用户版式覆盖决策：宽 1080 满幅，高=640−24×2，上下小边距）" },
  segs: segs.map(s => ({ id: s.id, seg: s.seg, start: +s.start.toFixed(2), dur: +s.dur.toFixed(2), panel: s.panel ? (s.panel.card ? s.panel.card.split("/").pop() : `m2@${s.panel.clip.from}`) : "收起" })),
};
writeFileSync("G:/tempcache/e-rev2/parent-post-v4-summary.json", JSON.stringify(summary, null, 1));
writeFileSync("G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/sources/工程脚本/parent-post-v4-summary.json", JSON.stringify(summary, null, 1));
console.log("done");
