// 生成少年旁白：逐句 TTS（小雅声）→ 解码 wav → 测时长（铁律3 wav 真值）→ timeline JSON
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { TEEN } from "./teen-narration.mjs";

const OUT = "G:/tempcache/f-pkg/audio-teen";
const VOICE = "S_5kGoqDYd2"; // 小雅声
const TTS = "G:/mediaProjects/video-factory/pipeline/speech_tts.py";
const FFMPEG = "H:/dev-env/ffmpeg/bin/ffmpeg.exe";
const FFPROBE = "H:/dev-env/ffmpeg/bin/ffprobe.exe";
const ENV = { ...process.env, TEMP: "G:/tempcache/f-pkg", TMP: "G:/tempcache/f-pkg", TMPDIR: "G:/tempcache/f-pkg" };

mkdirSync(OUT, { recursive: true });

function durOf(wav) {
  const out = execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav], { encoding: "utf8" });
  return parseFloat(out.trim());
}

const timeline = [];
for (const shot of TEEN) {
  const sentences = [];
  for (let i = 0; i < shot.sentences.length; i++) {
    const s = shot.sentences[i];
    const base = `${OUT}/${shot.id}-${i}`;
    const mp3 = base + ".mp3", wav = base + ".wav";
    if (!existsSync(wav)) {
      console.log(`TTS ${shot.id}-${i}: ${s.tts.slice(0, 24)}...`);
      execFileSync("python", [TTS, s.tts, mp3, "--voice", VOICE], { env: ENV, stdio: ["ignore", "pipe", "inherit"] });
      // 铁律3：先解码为统一 wav 再测时长
      execFileSync(FFMPEG, ["-y", "-v", "error", "-i", mp3, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
    }
    const dur = durOf(wav);
    sentences.push({ ...s, wav, dur });
    console.log(`  ${shot.id}-${i} dur=${dur.toFixed(3)}s`);
  }
  timeline.push({ id: shot.id, file: shot.file, tab: shot.tab, title: shot.title, sentences });
}
writeFileSync("G:/tempcache/f-pkg/teen-timeline.json", JSON.stringify(timeline, null, 1));
const total = timeline.reduce((a, t) => a + t.sentences.reduce((b, s) => b + s.dur, 0), 0);
console.log(`TOTAL narration: ${total.toFixed(1)}s  ->  G:/tempcache/f-pkg/teen-timeline.json`);
