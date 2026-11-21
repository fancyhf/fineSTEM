// 家长口播排片样片：信息卡/占位卡 + M2 作品实录插片 + 芳姐声旁白 + 字幕块式
// 产出 1080×1920 竖屏样片（真人镜头为占位卡，如实标注；时间轴以 TTS 实测为据，真人配音后须重排）
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";

const TMP = "G:/tempcache/f-pkg/post-parent";
const CARDS = "G:/tempcache/f-pkg/cards";
const PH = "G:/tempcache/f-pkg/placeholders";
const M2 = "G:/tempcache/f-pkg/m2";
const AUD = "G:/tempcache/f-pkg/audio-parent";
const OUTDIR = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/家长短视频";
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };
const GAP = 0.3, LEAD = 0.45, TAIL = 0.7, LEAD2 = 0.25, TAIL2 = 0.45; // 续段用紧凑值

mkdirSync(TMP, { recursive: true });
mkdirSync(`${OUTDIR}/旁白音轨`, { recursive: true });
const run = (args) => execFileSync(FFMPEG, args, { env: ENV, stdio: ["ignore", "pipe", "pipe"] });
const probe = (f) => parseFloat(execFileSync(FFMPEG.replace("ffmpeg.exe", "ffprobe.exe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8", env: ENV }).trim());
const silence = (sec, file) => run(["-y", "-f", "lavfi", "-t", Math.max(0.05, sec).toFixed(3), "-i", "anullsrc=r=24000:cl=mono", "-c:a", "pcm_s16le", file]);

// ---------- 0) 逐句静音修剪（保留 0.12s 呼吸；不加快语速，只去死气口） ----------
const timeline = JSON.parse(readFileSync("G:/tempcache/f-pkg/parent-timeline.json", "utf8"));
const trimmed = {}; // key -> {wav, dur}
for (const shot of timeline) for (const s of shot.sentences) {
  if (s.deleted) continue;
  const key = s.wav;
  const outW = key.replace(".wav", "-trim.wav");
  if (!trimmed[key]) {
    run(["-y", "-i", key, "-af",
      "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.10,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.10,areverse",
      "-c:a", "pcm_s16le", outW]);
    let d = probe(outW);
    trimmed[key] = { wav: outW, dur: d };
  }
}
const T = (s) => trimmed[s.wav];

// ---------- 1) 分段计划 ----------
// type: card=全屏卡 | cardclip=卡+插片 | end=落版
// M2 插片窗口（秒，m2-take.mp4 内）：will fill after recording; placeholders "A/B" replaced by args
const plan = [
  { id: "p1", img: `${PH}/P1-真人占位.png`, sents: ["p1-0"], type: "card" },
  { id: "p2a", img: `${CARDS}/M6-三个数字.png`, sents: ["p2-0", "p2-1"], type: "card", cont: false },
  { id: "p2b", img: `${CARDS}/M6-三个数字.png`, sents: ["p2-2"], type: "cardclip", cont: true, clip: { src: `${M2}/m2-take.mp4`, from: 1.4, to: 4.4, crop: "680:490:370:110" } },
  { id: "p3a", img: `${CARDS}/M7-手算竖式.png`, sents: ["p3-0", "p3-1"], type: "card" },
  { id: "p3b", img: `${CARDS}/M7-手算竖式.png`, sents: ["p3-2"], type: "cardclip", cont: true, clip: { src: `${M2}/m2-take.mp4`, from: 5.6, to: 9.6, crop: "680:490:370:110" } },
  { id: "p4a", img: `${CARDS}/M4-对照卡.png`, sents: ["p4-0", "p4-1"], type: "card" },
  { id: "p4b", img: `${CARDS}/M4-对照卡.png`, sents: ["p4-2"], type: "cardclip", cont: true, clip: { src: `${M2}/m2-drought.mp4`, from: 3.2, to: 10.0, crop: "680:480:370:135" } },
  { id: "p5a", img: `${CARDS}/M5a-三档与最短板.png`, sents: ["p5-0", "p5-1", "p5-2"], type: "card" },
  { id: "p5b", img: `${PH}/P5b-真人占位.png`, sents: ["p5-3"], type: "card" },
  { id: "p6", img: `${CARDS}/M5b-圣马太岛.png`, sents: ["p6-0", "p6-1", "p6-2"], type: "card" },
  { id: "p7a", img: `${PH}/P7-真人占位.png`, sents: ["p7-0"], type: "card" },
  { id: "p7b", img: `${PH}/P7-真人占位.png`, sents: ["p7-1", "p7-2"], type: "cardclip", cont: true, clip: { src: `${M2}/m2-take.mp4`, from: 11.0, to: 18.4, crop: "480:300:1085:780" } },
  { id: "p8a", img: `${PH}/P8-真人占位.png`, sents: ["p8-0"], type: "card" },
  { id: "p8b", img: `${PH}/P8b-落版.png`, sents: ["p8-1"], type: "end" },
];
const sentById = {};
for (const shot of timeline) shot.sentences.forEach(s => { sentById[s.display] = s; });
const sentSeq = {};
for (const shot of timeline) { shot.sentences.forEach((s, i) => { if (!s.deleted) sentSeq[`${shot.id}-${i}`] = s; }); }

// ---------- 2) 逐段时长 + 音轨 + 全局时间轴 ----------
let cursor = 0;
const segs = [];
const blocks = []; // 字幕块 {start,end,text,concept}
for (const seg of plan) {
  const lead = seg.cont ? LEAD2 : LEAD, tail = seg.cont ? TAIL2 : TAIL;
  const wavs = seg.sents.map(k => sentSeq[k]);
  const durs = wavs.map(T);
  const speech = durs.reduce((a, d) => a + d.dur, 0);
  const dur = lead + speech + GAP * (wavs.length - 1) + tail;
  // 音轨（用修剪后的 wav，与 durs 一致）
  const parts = [];
  const sf = `${TMP}/${seg.id}-lead.wav`; silence(lead, sf); parts.push(sf);
  wavs.forEach((w, i) => {
    parts.push(T(w).wav);
    blocks.push({ start: cursor + lead + durs.slice(0, i).reduce((a, d) => a + d.dur, 0) + GAP * i, end: cursor + lead + durs.slice(0, i + 1).reduce((a, d) => a + d.dur, 0) + GAP * i, text: w.display, id: seg.sents[i] });
    if (i < wavs.length - 1) { const g = `${TMP}/${seg.id}-gap${i}.wav`; silence(GAP, g); parts.push(g); }
  });
  const tf = `${TMP}/${seg.id}-tail.wav`; silence(tail, tf); parts.push(tf);
  const list = `${TMP}/${seg.id}-a.txt`;
  writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
  run(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", `${TMP}/${seg.id}-audio.wav`]);
  segs.push({ ...seg, dur, start: cursor });
  cursor += dur;
}

// ---------- 3) 逐段视频 ----------
const ZOOM = "scale=1080:1920,zoompan=z='zoom+0.00015':d=1:x='iw/2-(iw/2/zoom)':y='ih/2-(ih/2/zoom)':s=1080x1920:fps=30";
for (const seg of segs) {
  const args = ["-y", "-framerate", "30"];
  if (seg.type === "cardclip") {
    // 背景卡 + 插片（带白边框底垫）
    const c = seg.clip;
    const from = Math.max(0, c.from), durClip = c.to - c.from;
    args.push("-loop", "1", "-t", seg.dur.toFixed(3), "-i", seg.img);
    args.push("-ss", from.toFixed(2), "-t", Math.min(durClip, seg.dur).toFixed(2), "-i", c.src);
    args.push("-filter_complex",
      `[0:v]${ZOOM}[bg];` +
      `[1:v]crop=${c.crop},scale=880:-2,drawbox=c=white:w=6:h=6:t=fill[pic];` +
      `[bg][pic]overlay=100:1100:enable='between(t,${(LEAD2 - 0.1).toFixed(2)},${seg.dur.toFixed(2)})'[v]`,
      "-map", "[v]");
  } else {
    args.push("-loop", "1", "-t", seg.dur.toFixed(3), "-i", seg.img);
    if (seg.type === "end") args.push("-vf", `${ZOOM},fade=t=in:st=0:d=0.7`);
    else args.push("-vf", ZOOM);
  }
  args.push("-t", seg.dur.toFixed(3), "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
    `${TMP}/${seg.id}-video.mp4`);
  run(args);
  console.log(`seg ${seg.id}: ${seg.dur.toFixed(2)}s`);
}

// ---------- 4) 字幕块式（行≤14、块≤20、三预设轮换、概念词朱砂内嵌） ----------
function pack(sentence, id) {
  // 切短语（保留标点）
  const tokens = []; let cur = "";
  for (const ch of sentence) { cur += ch; if ("，。？！；：、".includes(ch)) { tokens.push(cur); cur = ""; } }
  if (cur) tokens.push(cur);
  // 贪心打包：行≤14、块≤20
  const blocksTxt = [];
  let lines = [""];
  for (const tk of tokens) {
    const l0 = lines[0] || "", l1 = lines[1] || "";
    if (lines[1] === undefined && (l0.length + tk.length) <= 14 && (l0.length + tk.length) <= 20) { lines[0] = l0 + tk; continue; }
    if (lines[1] === undefined && l0.length >= 1) { lines[1] = tk; continue; }
    if (lines[1] !== undefined && (l1.length + tk.length) <= 14 && (l0.length + l1.length + tk.length) <= 20) { lines[1] = l1 + tk; continue; }
    if (l0 || l1) blocksTxt.push({ lines: [l0, l1].filter(Boolean) });
    lines = [tk];
  }
  if (lines[0] || lines[1]) blocksTxt.push({ lines: [lines[0], lines[1]].filter(Boolean) });
  return blocksTxt;
}
const CONCEPTS = ["限制因子"];
const subBlocks = [];
for (const b of blocks) {
  const packed = pack(b.text, b.id);
  const totalChars = packed.reduce((a, p) => a + p.lines.join("").length, 0);
  let t = b.start;
  for (const p of packed) {
    const share = p.lines.join("").length / totalChars;
    let d = Math.max(0.35, share * (b.end - b.start));
    subBlocks.push({ start: t, end: Math.min(b.end, t + d), lines: p.lines });
    t += d;
  }
}
const fmtTime = (t, comma = true) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (comma) {
    // SRT：HH:MM:SS,mmm
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")},${String(Math.round((s - Math.floor(s)) * 1000)).padStart(3, "0")}`;
  }
  // ASS 标准格式 H:MM:SS.cc（厘秒 2 位）——本机 libass 对 "00:00:00.800"（3 位小数 + 2 位小时）会静默丢事件
  return `${h}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}.${String(Math.round((s - Math.floor(s)) * 100)).padStart(2, "0")}`;
};
// SRT（块级）
writeFileSync(`${OUTDIR}/生态岛-家长口播.srt`, "\uFEFF" + subBlocks.map((b, i) => `${i + 1}\n${fmtTime(b.start)} --> ${fmtTime(b.end)}\n${b.lines.join("\n")}\n`).join("\n"), "utf8");
// ASS（错落三预设轮换；概念词朱砂内嵌——同屏仅一处）
const rot = [
  { a: 2, l: 90, r: 90 },   // 居中
  { a: 1, l: 150, r: 260 }, // 左置
  { a: 3, l: 260, r: 150 }, // 右置
];
const events = subBlocks.map((b, i) => {
  const r = rot[i % 3];
  const text = b.lines.join("\\N");
  const hasConcept = b.lines.some(l => l.includes("限制因子"));
  const body = hasConcept ? text.replace("限制因子", "{\\fs72\\c&H2B39C0&}限制因子{\\fs\\c&H252A2E&}") : text;
  return `Dialogue: 0,${fmtTime(b.start, false)},${fmtTime(b.end, false)},Sub,,0,0,0,,{\\an${r.a}}${body}`;
});
const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Microsoft YaHei,50,&H00252A2E,&H00252A2E,&H00F5F0E8,&H5A000000,1,0,0,0,100,100,0,0,1,3,0,2,150,150,320,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
writeFileSync(`${TMP}/parent.ass`, "\uFEFF" + assHeader + events.join("\n") + "\n", "utf8");

// ---------- 5) 拼接 + 烧字幕 + 混音 ----------
writeFileSync(`${TMP}/v-list.txt`, segs.map(s => `file '${TMP}/${s.id}-video.mp4'`).join("\n").replace(/\\\\/g, "/"));
writeFileSync(`${TMP}/a-list.txt`, segs.map(s => `file '${TMP}/${s.id}-audio.wav'`).join("\n").replace(/\\\\/g, "/"));
run(["-y", "-f", "concat", "-safe", "0", "-i", `${TMP}/a-list.txt`, "-c:a", "pcm_s16le", `${TMP}/full-24k.wav`]);
run(["-y", "-i", `${TMP}/full-24k.wav`, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", `${TMP}/full-norm.wav`]);
const finalMp4 = `${OUTDIR}/生态岛-家长口播-排片样片-v1.mp4`;
writeFileSync(`${TMP}/v-list.txt`, segs.map(s => `file '${TMP}/${s.id}-video.mp4'`).join("\n"));
execFileSync(FFMPEG, ["-y",
  "-f", "concat", "-safe", "0", "-i", "v-list.txt",
  "-i", "full-norm.wav",
  "-vf", "ass=parent.ass",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest",
  finalMp4], { env: ENV, cwd: TMP, stdio: ["ignore", "pipe", "pipe"] });
const vDur = probe(finalMp4), aDur = probe(`${TMP}/full-norm.wav`);
console.log(`final: ${finalMp4}`);
console.log(`video=${vDur.toFixed(2)}s audio=${aDur.toFixed(2)}s blocks=${subBlocks.length}`);
writeFileSync("G:/tempcache/f-pkg/parent-post-summary.json", JSON.stringify({ vDur, aDur, segs: segs.map(s => ({ id: s.id, dur: s.dur, start: s.start })) }, null, 1));
// 旁白全轨交付
execFileSync("cmd", ["/c", "copy", "/Y", `${TMP}\\full-norm.wav`, `${OUTDIR}\\旁白音轨\\芳姐声旁白-TTS小样.wav`]);
console.log("done");
