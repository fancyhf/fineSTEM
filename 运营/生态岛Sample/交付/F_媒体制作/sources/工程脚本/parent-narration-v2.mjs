// 家长口播 v2（三栏式改版）逐镜旁白：芳姐声 S_VgvqqDYd2 → wav 真值时长 → parent-timeline-v2.json
// 口播词全文见 E 包 parent-video-script.md（2026-11-04 三栏改版稿）；数字读法按 E 简报 §3 转写
// 中间产物目录：G:/tempcache/e-rev/（E+F 联合修订专用，不与 f-pkg 混放）
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const OUT = "G:/tempcache/e-rev/audio-parent";
const TMP = "G:/tempcache/e-rev";
const VOICE = "S_VgvqqDYd2"; // 芳姐声（2026-10-20 吾皇定档，长期有效）
const TTS = "G:/mediaProjects/video-factory/pipeline/speech_tts.py";
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const FFPROBE = "H:/dev-env/ffmpeg/bin/ffprobe.exe";
const ENV = { ...process.env, TEMP: TMP, TMP: TMP, TMPDIR: TMP };
mkdirSync(OUT, { recursive: true });

// ---------- 删减开关（E 脚本 §三 顺序；实测口播 > 115 秒时按序置 true 重跑）----------
const CUT = { timer: false, liveline: false, handcalc: false };

const PARENT = [
  {
    id: "p1", visual: "三栏开场：顶栏节目名+声波线；中栏演示面板收起；底栏台词块",
    sentences: [
      { display: "把一座小岛的雨关掉，接下来会发生什么。", tts: "把一座小岛的雨关掉，接下来会发生什么。" },
    ],
  },
  {
    id: "p2", visual: "中栏演示面板：M6 三个数字卡（中栏版）淡入",
    sentences: [
      { display: "我们做了一个生态小网页，一座会变的小岛。", tts: "我们做了一个生态小网页，一座会变的小岛。" },
      { display: "草、小动物、水，三个数字决定小岛的命运。", tts: "草、小动物、水，三个数字决定小岛的命运。" },
    ],
  },
  {
    id: "p3", visual: "中栏演示面板：M2 作品实录（点开始，数字逐步跳动）",
    sentences: [
      { display: "每走一步，程序重算一遍三个数字，这叫状态更新。", tts: "每走一步，程序重算一遍三个数字，这叫状态更新。" },
      { display: "没有随机数，同样的开始永远同样的结果，叫纯函数。", tts: "没有随机数，同样的开始永远同样的结果，叫纯函数。" },
    ],
  },
  {
    id: "p4", visual: "中栏演示面板：M2 作品实录（走一步，定时器节奏）",
    sentences: [
      { display: "水喝干草就停长，草够吃小动物才安家，这叫条件分支。", tts: "水喝干草就停长，草够吃小动物才安家，这叫条件分支。" },
      { display: "催它一拍一拍往前走的，是定时器。", tts: "催它一拍一拍往前走的，是定时器。", cut: "timer" },
    ],
  },
  {
    id: "p5", visual: "中栏演示面板：M7 手算竖式卡（中栏版）淡入",
    sentences: [
      { display: "草喂动物，动物喝水，水养草，三个数字互相牵制。", tts: "草喂动物，动物喝水，水养草，三个数字互相牵制。" },
      { display: "第一步拿笔就算，孩子算的数和屏幕一模一样。", tts: "第一步拿笔就算，孩子算的数和屏幕一模一样。", cut: "handcalc" },
    ],
  },
  {
    id: "p6", visual: "中栏演示面板：M4 对照卡（中栏版）淡入",
    sentences: [
      { display: "有意思的是对照。", tts: "有意思的是对照。" },
      { display: "中雨的岛，小动物第9步归零，后来草长回来，动荡，但活着。", tts: "中雨的岛，小动物在第九步归零，后来草长回来，动荡，但活着。" },
      { display: "把雨关掉，水第47步喝干，第60步三个数字全部见底。", tts: "把雨关掉，水第四十七步喝干，第六十步三个数字全部见底。" },
    ],
  },
  {
    id: "p7", visual: "中栏演示面板：M5a 三档与最短板卡（中栏版）淡入；字幕概念词「限制因子」朱砂内嵌",
    sentences: [
      { display: "三档雨都试过，卡住小动物的是草长得慢。", tts: "三档雨都试过，卡住小动物的是草长得慢。" },
      { display: "补的不是最缺的那块，结局就不会变，这叫限制因子。", tts: "补的不是最缺的那块，结局就不会变，这叫限制因子。" },
    ],
  },
  {
    id: "p8", visual: "中栏演示面板：M5b 圣马太岛卡（中栏版）淡入",
    sentences: [
      { display: "圣马太岛是真实的对应：1944年29头驯鹿，1963年约六千头，1966年只剩42头。", tts: "圣马太岛是真实的对应：一九四四年，二十九头驯鹿，一九六三年大约六千头，一九六六年只剩四十二头。" },
      { display: "冲过承载力，再摔下来。", tts: "冲过承载力，再摔下来。" },
    ],
  },
  {
    id: "p9", visual: "中栏演示面板：M10 多结局卡（中栏版）淡入",
    sentences: [
      { display: "也有平安的开局：草三十、动物二，六十步没消失。", tts: "也有平安的开局：草三十、动物二，六十步没消失。" },
      { display: "找活路，是孩子的实验。", tts: "找活路，是孩子的实验。", cut: "liveline" },
    ],
  },
  {
    id: "p10", visual: "中栏演示面板：M8 边界卡（中栏版）淡入；科学边界句",
    sentences: [
      { display: "要说全一句：小动物归零，草和水会自己恢复，不等于物种灭绝。", tts: "要说全一句：小动物归零，草和水会自己恢复，不等于物种灭绝。" },
    ],
  },
  {
    id: "p11", visual: "中栏演示面板：M9 产出卡（中栏版）淡入",
    sentences: [
      { display: "做完，孩子手里有三样东西：小岛网页、手算记录、实验报告。", tts: "做完，孩子手里有三样东西：小岛网页、手算记录、实验报告。" },
    ],
  },
  {
    id: "p12", visual: "中栏演示面板：落版卡（作品名）淡入后随片尾淡出",
    sentences: [
      { display: "改变一个条件，看哪些数字跟着变。", tts: "改变一个条件，看哪些数字跟着变。" },
      { display: "这件事，孩子能在一座小岛上亲手做完。", tts: "这件事，孩子能在一座小岛上亲手做完。" },
    ],
  },
];

function durOf(wav) {
  return parseFloat(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav], { encoding: "utf8" }).trim());
}
const timeline = [];
let total = 0, chars = 0;
for (const shot of PARENT) {
  const sentences = [];
  for (let i = 0; i < shot.sentences.length; i++) {
    const s = shot.sentences[i];
    const isCut = s.cut && CUT[s.cut];
    const base = `${OUT}/${shot.id}-${i}`;
    const mp3 = base + ".mp3", wav = base + ".wav";
    if (!existsSync(wav)) {
      console.log(`TTS ${shot.id}-${i}: ${s.tts.slice(0, 16)}...`);
      execFileSync("python", [TTS, s.tts, mp3, "--voice", VOICE], { env: ENV, stdio: ["ignore", "pipe", "inherit"] });
      execFileSync(FFMPEG, ["-y", "-v", "error", "-i", mp3, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    }
    const dur = isCut ? 0 : durOf(wav);
    if (!isCut) { total += dur; chars += s.display.replace(/[，。：、—]/g, "").length; }
    sentences.push({ ...s, wav, dur, ...(isCut ? { deleted: true } : {}) });
    console.log(`  ${shot.id}-${i}${isCut ? " [按 E §三 删减：不入片]" : ""} dur=${dur.toFixed(3)}s`);
  }
  timeline.push({ id: shot.id, visual: shot.visual, sentences });
}
writeFileSync("G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/F_媒体制作/sources/工程脚本/parent-timeline-v2.json", JSON.stringify(timeline, null, 1));
console.log(`TOTAL narration: ${total.toFixed(1)}s, 口播汉字≈${chars}（目标 95-115 秒；超时按 E 脚本 §三 删减顺序置 CUT 开关重跑）`);
