// 家长口播逐镜旁白（芳姐声，E 冻结稿逐字）→ wav 真值时长 → timeline JSON
// 数字读法按 E 简报 §3 转写；字幕显示文本保持冻结稿原样
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const OUT = "G:/tempcache/f-pkg/audio-parent";
const VOICE = "S_VgvqqDYd2"; // 芳姐声
const TTS = "G:/mediaProjects/video-factory/pipeline/speech_tts.py";
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const FFPROBE = "H:/dev-env/ffmpeg/bin/ffprobe.exe";
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };
mkdirSync(OUT, { recursive: true });

const PARENT = [
  {
    id: "p1", needHuman: true, visual: "真人出镜+作品首帧浮出（M1 待拍摄；M2/M3 素材）",
    sentences: [
      { display: "把一座小岛的雨关掉，接下来会发生什么。", tts: "把一座小岛的雨关掉，接下来会发生什么。" },
    ],
  },
  {
    id: "p2", needHuman: false, visual: "信息卡M6三数字卡 + 2秒开始录屏（M2）",
    sentences: [
      { display: "我们做了一个生态小网页。", tts: "我们做了一个生态小网页。" },
      { display: "整座岛就是三个数字：草、小动物、水。", tts: "整座岛就是三个数字：草、小动物、水。" },
      // 删减#3（E 脚本 §三：实测超 118 秒时删"点开始，"三字）
      { display: "程序一步一步走，没有随机数，同样的开始，每一步都一样。", tts: "程序一步一步走，没有随机数，同样的开始，每一步都一样。" },
    ],
  },
  {
    id: "p3", needHuman: false, visual: "信息卡M7手算竖式 + 走一步录屏（M2）",
    sentences: [
      { display: "第一步就值得拿笔算。", tts: "第一步就值得拿笔算。" },
      { display: "水够，草先长2；小动物吃掉16份草；水补3、被喝掉6。", tts: "水够，草先长二；小动物吃掉十六份草；水补三、被喝掉六。" },
      { display: "孩子算出来的三个数，和屏幕上一模一样。", tts: "孩子算出来的三个数，和屏幕上一模一样。" },
    ],
  },
  {
    id: "p4", needHuman: false, visual: "信息卡M4对照卡（可插无雨岛录屏M2）",
    sentences: [
      { display: "有意思的是对照。", tts: "有意思的是对照。" },
      { display: "基础版用中雨：小动物在第9步掉到零，后来草长回来，小动物又迁进来，小岛动荡，但活着。", tts: "基础版用中雨：小动物在第九步掉到零，后来草长回来，小动物又迁进来，小岛动荡，但活着。" },
      { display: "只把下雨快慢改成不下雨，其他不动：水在第47步被喝干，草停止生长，第60步，三个数字全部见底。", tts: "只把下雨快慢改成不下雨，其他不动：水在第四十七步被喝干，草停止生长，第六十步，三个数字全部见底。" },
      // 删减#1（E 脚本 §三 删减顺序第1条）：末句"只差一场雨，两种结局。"仅删口播，M4 卡面文字保留
      { display: "只差一场雨，两种结局。", tts: "只差一场雨，两种结局。", deleted: true },
    ],
  },
  {
    id: "p5", needHuman: "后半", visual: "信息卡M5三档+最短板 → 后半真人出镜边界句（M1 待拍摄）",
    sentences: [
      { display: "小雨、中雨、大雨都试过，小动物还是差不多在第9步消失。", tts: "小雨、中雨、大雨都试过，小动物还是差不多在第九步消失。" },
      { display: "卡住它们的，是草的生长速度。", tts: "卡住它们的，是草的生长速度。" },
      { display: "补的如果不是最缺的那块，结局不会变，这叫限制因子。", tts: "补的如果不是最缺的那块，结局不会变，这叫限制因子。" },
      { display: "还有一句要说全：岛上小动物归零，草和水会自己恢复，不等于物种灭绝。", tts: "还有一句要说全：岛上小动物归零，草和水会自己恢复，不等于物种灭绝。" },
    ],
  },
  {
    id: "p6", needHuman: false, visual: "信息卡M5b圣马太岛数据卡",
    sentences: [
      { display: "现实里有对应的例子。", tts: "现实里有对应的例子。" },
      // 删减#2（E 脚本 §三）：删"失去了繁殖能力。"（约2秒）
      { display: "1944年，29头驯鹿被带上圣马太岛，1963年大约六千头，1966年只剩42头。", tts: "一九四四年，二十九头驯鹿被带上圣马太岛，一九六三年大约六千头，一九六六年只剩四十二头。" },
      { display: "这条曲线有名字：冲过承载力，再摔下来。", tts: "这条曲线有名字：冲过承载力，再摔下来。" },
    ],
  },
  {
    id: "p7", needHuman: "出镜", visual: "真人出镜+小岛日记滚动特写（M1 待拍摄；M2 补录）",
    sentences: [
      { display: "作品入口随内容一起发布，打开两三分钟就够。", tts: "作品入口随内容一起发布，打开两三分钟就够。" },
      { display: "看三个数字，看小岛日记，看步数记录。", tts: "看三个数字，看小岛日记，看步数记录。" },
      { display: "饭后可以问一句：小动物消失以后，草为什么反而长回来了。", tts: "饭后可以问一句：小动物消失以后，草为什么反而长回来了。" },
    ],
  },
  {
    id: "p8", needHuman: "出镜", visual: "真人出镜收尾→淡出作品全景→落版（M1 待拍摄）",
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
for (const shot of PARENT) {
  const sentences = [];
  for (let i = 0; i < shot.sentences.length; i++) {
    const s = shot.sentences[i];
    if (s.deleted) { sentences.push({ ...s, dur: 0 }); console.log(`  ${shot.id}-${i} [按 E §三 删减：不入片]`); continue; }
    const base = `${OUT}/${shot.id}-${i}`;
    const mp3 = base + ".mp3", wav = base + ".wav";
    if (!existsSync(wav)) {
      console.log(`TTS ${shot.id}-${i}: ${s.tts.slice(0, 20)}...`);
      execFileSync("python", [TTS, s.tts, mp3, "--voice", VOICE], { env: ENV, stdio: ["ignore", "pipe", "inherit"] });
      execFileSync(FFMPEG, ["-y", "-v", "error", "-i", mp3, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    }
    const dur = durOf(wav);
    sentences.push({ ...s, wav, dur });
    console.log(`  ${shot.id}-${i} dur=${dur.toFixed(3)}s`);
  }
  timeline.push({ id: shot.id, needHuman: shot.needHuman, visual: shot.visual, sentences });
}
writeFileSync("G:/tempcache/f-pkg/parent-timeline.json", JSON.stringify(timeline, null, 1));
const total = timeline.reduce((a, t) => a + t.sentences.reduce((b, s) => b + s.dur, 0), 0);
console.log(`TOTAL narration: ${total.toFixed(1)}s (frozen-script estimate: 94-106s, cap 120s; 超时删减顺序见脚本 §三)`);
