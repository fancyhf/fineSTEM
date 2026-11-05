// 少年视频后期：逐镜音轨（旁白+静音补齐）→ 全轨 → SRT/ASS 字幕 → 拼接+烧录+混流
// v4（2026-11-05）：输出名升级 v4（岛民口径稿）；镜 6（平台实录 seg6，60s 真实操作 take 的剪接入片）
//   以 segments 清单里的 offset/sgap 参数化接入（offset=8.0 对位动作，见 record-shot6-v3.mjs 文件头），字幕全量 102 句。
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";

const TMP = "G:/tempcache/f-pkg/post-teen";
const VID = "G:/tempcache/f-pkg/video-teen";
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const FFPROBE = "H:/dev-env/ffmpeg/bin/ffprobe.exe";
const OUTDIR = "G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/少年讲解视频";
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };
const LEAD = 0.8, GAP = 0.45;

const timeline = JSON.parse(readFileSync("G:/tempcache/f-pkg/teen-timeline.json", "utf8"));
const segments = JSON.parse(readFileSync("G:/tempcache/f-pkg/teen-segments.json", "utf8"));
mkdirSync(TMP, { recursive: true });
mkdirSync(OUTDIR, { recursive: true });

const run = (args) => execFileSync(FFMPEG, args, { env: ENV, stdio: ["ignore", "pipe", "pipe"] });
const silence = (sec, file) => run(["-y", "-f", "lavfi", "-t", sec.toFixed(3), "-i", "anullsrc=r=24000:cl=mono", "-c:a", "pcm_s16le", file]);

// ---------- 1) 逐镜音轨 + 全轨 + 时间轴 ----------
const fmtTime = (t, comma = true) => {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const ms = comma ? "," : ".";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}${ms}${String(Math.round((s - Math.floor(s)) * 1000)).padStart(3, "0")}`;
};

let segOffset = 0;
const subs = []; // {start, end, text}
const concatAudio = [];
for (const seg of segments) {
  const t = timeline.find(x => x.id === seg.id);
  const starts = [];
  const startAt = seg.offset ?? LEAD;
  let x = startAt;
  const sgap = seg.sgap ?? GAP;
  const parts = [];
  const lead = `${TMP}/${seg.id}-000-lead.wav`;
  silence(startAt, lead); parts.push(lead);
  t.sentences.forEach((s, i) => {
    starts.push(segOffset + x);
    parts.push(s.wav);
    x += s.dur;
    subs.push({ start: segOffset + x - s.dur, end: segOffset + x + Math.min(GAP * 0.7, 0.32), text: s.display });
    if (i < t.sentences.length - 1) { const g = `${TMP}/${seg.id}-gap-${i}.wav`; silence(sgap, g); parts.push(g); x += sgap; }
  });
  const used = startAt + t.sentences.reduce((a, s) => a + s.dur, 0) + sgap * (t.sentences.length - 1);
  const pad = Math.max(0.05, seg.dur - used);
  const tail = `${TMP}/${seg.id}-999-tail.wav`;
  silence(pad, tail); parts.push(tail);
  // 拼段内音轨
  const listFile = `${TMP}/${seg.id}-audio.txt`;
  writeFileSync(listFile, parts.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
  run(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c:a", "pcm_s16le", `${TMP}/${seg.id}-audio.wav`]);
  concatAudio.push(`${TMP}/${seg.id}-audio.wav`);
  segOffset += seg.dur;
}
// 拼全轨
writeFileSync(`${TMP}/all-audio.txt`, concatAudio.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
run(["-y", "-f", "concat", "-safe", "0", "-i", `${TMP}/all-audio.txt`, "-c:a", "pcm_s16le", `${TMP}/full-24k.wav`]);
// 响度：loudnorm 单遍（小样级别）+ 限幅
run(["-y", "-i", `${TMP}/full-24k.wav`, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", `${TMP}/full-norm.wav`]);

// ---------- 2) SRT + ASS ----------
const srt = subs.map((s, i) => `${i + 1}\n${fmtTime(s.start)} --> ${fmtTime(s.end)}\n${s.text}\n`).join("\n");
writeFileSync(`${OUTDIR}/生态岛-少年操作讲解-v4.srt`, "\uFEFF" + srt, "utf8");

// ASS：双语行拆分（≤26 字符/行，按标点贪心），底部居中，雅黑粗体
function splitLines(text, max = 26) {
  const tokens = [];
  let cur = "";
  for (const ch of text) { cur += ch; if ("，。？！；：、——".includes(ch)) { tokens.push(cur); cur = ""; } }
  if (cur) tokens.push(cur);
  const lines = []; let line = "";
  for (const tk of tokens) {
    if ((line + tk).length > max && line) { lines.push(line); line = tk; } else line += tk;
  }
  if (line) lines.push(line);
  return lines;
}
const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Microsoft YaHei,52,&H00FFFFFF,&H00FFFFFF,&H00182018,&H7A000000,1,0,0,0,100,100,0,0,1,3,1,2,60,60,72,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
const assEvents = subs.map(s => {
  const lines = splitLines(s.text);
  return `Dialogue: 0,${fmtTime(s.start, false)},${fmtTime(s.end, false)},Sub,,0,0,0,,${lines.join("\\N")}`;
}).join("\n");
writeFileSync(`${TMP}/teen.ass`, "\uFEFF" + assHeader + assEvents + "\n", "utf8");

// ---------- 3) 视频拼接 + 烧字幕 + 混流 ----------
const videoList = segments.map(s => `file '${s.file.replace(/\\/g, "/")}'`).join("\n");
writeFileSync(`${TMP}/video-list.txt`, videoList);
const finalMp4 = `${OUTDIR}/生态岛-少年操作讲解-测试片-v4.mp4`;
execFileSync(FFMPEG, ["-y",
  "-f", "concat", "-safe", "0", "-i", "video-list.txt",
  "-i", "full-norm.wav",
  "-vf", "ass=teen.ass",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k",
  "-movflags", "+faststart", "-shortest",
  finalMp4], { env: ENV, cwd: TMP, stdio: ["ignore", "pipe", "pipe"] });
console.log("final:", finalMp4);

// ---------- 4) 校验数据 ----------
const vDur = parseFloat(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", finalMp4], { encoding: "utf8", env: ENV }).trim());
const aDur = parseFloat(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `${TMP}/full-norm.wav`], { encoding: "utf8", env: ENV }).trim());
console.log(`video=${vDur.toFixed(2)}s audio=${aDur.toFixed(2)}s diff=${Math.abs(vDur - aDur).toFixed(2)}s`);
writeFileSync("G:/tempcache/f-pkg/teen-post-summary.json", JSON.stringify({ vDur, aDur, segOffset, subs: subs.length }, null, 1));
