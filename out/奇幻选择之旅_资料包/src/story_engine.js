// 奇幻选择之旅 —— 故事引擎
let currentChapterId = "start";
let discoveredEndings = new Set();
let totalEndings = STORY_DATA.endings.length;
let history = [];
let endingCount = 0;
const storyText = document.getElementById("story-text");
const optionsArea = document.getElementById("options-area");
const progressFill = document.getElementById("progress-fill");
const chapterTag = document.getElementById("chapter-tag");
const endingCountSpan = document.getElementById("ending-count");
const restartBtn = document.getElementById("restart-btn");
const canvas = document.getElementById("scene-canvas");
const ctx = canvas.getContext("2d");
function drawScene(sceneId) {
ctx.clearRect(0, 0, 400, 200);
ctx.imageSmoothingEnabled = false;
// 通用背景
ctx.fillStyle = "#1a2b1f";
ctx.fillRect(0, 0, 400, 200);
switch(sceneId) {
case "forest":
// 树木
for (let i = 0; i < 8; i++) {
ctx.fillStyle = "#2d4a2d";
ctx.fillRect(30 + i * 48, 60, 24, 120);
ctx.fillStyle = "#3a6b3a";
ctx.beginPath();
ctx.arc(42 + i * 48, 50, 24, 0, Math.PI * 2);
ctx.fill();
}
// 迷雾
ctx.fillStyle = "rgba(200, 216, 181, 0.3)";
for (let i = 0; i < 10; i++) {
ctx.fillRect(i * 45, Math.random() * 150 + 20, 30, 8);
}
break;
case "cabin":
ctx.fillStyle = "#5c3a1e";
ctx.fillRect(120, 80, 160, 100);
ctx.fillStyle = "#8b6914";
ctx.fillRect(170, 110, 60, 50);
ctx.fillStyle = "#f5deb3";
ctx.fillRect(165, 105, 10, 10);
ctx.fillRect(225, 105, 10, 10);
ctx.fillStyle = "#3a2a1a";
for (let i = 0; i < 6; i++) {
ctx.fillRect(135 + i * 25, 75, 8, 6);
}
break;
case "lake":
ctx.fillStyle = "#1a2b3a";
ctx.fillRect(0, 0, 400, 200);
ctx.fillStyle = "#2a5a7a";
ctx.fillRect(30, 80, 340, 100);
ctx.fillStyle = "#f5e6c8";
ctx.beginPath();
ctx.arc(320, 50, 35, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = "rgba(255, 255, 200, 0.2)";
for (let i = 0; i < 5; i++) {
ctx.fillRect(50 + i * 70, 95 + (i % 2) * 20, 15, 5);
}
break;
case "forge":
ctx.fillStyle = "#2a1a0a";
ctx.fillRect(0, 0, 400, 200);
ctx.fillStyle = "#6b3a1a";
ctx.fillRect(150, 130, 100, 50);
ctx.fillStyle = "#ff6a00";
for (let i = 0; i < 4; i++) {
ctx.fillRect(165 + i * 18, 140, 8, 8);
}
ctx.fillStyle = "#4a2a1a";
ctx.fillRect(90, 40, 50, 90);
break;
case "garden":
ctx.fillStyle = "#1a2a1a";
ctx.fillRect(0, 0, 400, 200);
const colors = ["#ff6b8a", "#ffd700", "#7bf5a0", "#b0a0ff"];
for (let i = 0; i < 5; i++) {
ctx.fillStyle = colors[i % colors.length];
ctx.beginPath();
ctx.arc(50 + i * 75, 100 + (i % 2) * 30, 15, 0, Math.PI * 2);
ctx.fill();
}
ctx.fillStyle = "#5a8ab5";
ctx.fillRect(175, 75, 50, 70);
ctx.fillStyle = "rgba(255, 255, 200, 0.3)";
for (let i = 0; i < 5; i++) {
ctx.fillRect(20 + i * 80, 50 + (i % 2) * 30, 6, 6);
}
break;
case "good":
ctx.fillStyle = "#0a1a2a";
ctx.fillRect(0, 0, 400, 200);
ctx.fillStyle = "#ffd700";
for (let i = 0; i < 10; i++) {
ctx.beginPath();
ctx.arc(30 + i * 38, 50 + (i % 3) * 40, 8, 0, Math.PI * 2);
ctx.fill();
}
ctx.fillStyle = "#f0e6d2";
ctx.font = "40px monospace";
ctx.fillText("✨", 180, 120);
break;
case "bad":
ctx.fillStyle = "#2a2a2a";
ctx.fillRect(0, 0, 400, 200);
ctx.fillStyle = "#5a5a5a";
ctx.fillRect(130, 90, 140, 80);
ctx.fillStyle = "#8a8a7a";
for (let i = 0; i < 5; i++) {
ctx.fillRect(155 + i * 22, 100, 10, 10);
}
ctx.fillStyle = "#c8c8b0";
ctx.font = "40px monospace";
ctx.fillText("🌅", 180, 140);
break;
}
function showChapter(chapterId) {
currentChapterId = chapterId;
history.push(chapterId);
let chapter = STORY_DATA.chapters.find(c => c.id === chapterId);
if (!chapter) {
showEnding(chapterId);
return;
}
storyText.textContent = chapter.text;
chapterTag.textContent = chapter.title;
drawScene(chapter.image || "forest");
// 计算进度
const totalSteps = STORY_DATA.chapters.length;
const currentIndex = STORY_DATA.chapters.findIndex(c => c.id === chapterId);
const progress = ((currentIndex + 1) / totalSteps) * 100;
progressFill.style.width = Math.min(progress, 100) + "%";
// 生成选项按钮
optionsArea.innerHTML = "";
chapter.options.forEach(opt => {
const btn = document.createElement("button");
btn.className = "option-btn";
btn.textContent = opt.text;
btn.addEventListener("click", () => showChapter(opt.next));
optionsArea.appendChild(btn);
});
restartBtn.style.display = "none";
}
function showEnding(endingId) {
let ending = STORY_DATA.endings.find(e => e.id === endingId);
if (!ending) return;
storyText.textContent = ending.text;
chapterTag.textContent = ending.title;
drawScene(ending.image || "bad");
progressFill.style.width = "100%";
// 记录结局
if (!discoveredEndings.has(endingId)) {
discoveredEndings.add(endingId);
endingCount++;
}
endingCountSpan.textContent = `已发现结局：${discoveredEndings.size} / ${totalEndings}`;
// 显示结局提示
optionsArea.innerHTML = "";
const msg = document.createElement("p");
msg.textContent = "🏁 你已到达故事终点";
msg.style.color = "#f5deb3";
msg.style.fontSize = "18px";
msg.style.textAlign = "center";
msg.style.padding = "12px";
optionsArea.appendChild(msg);
restartBtn.style.display = "inline-block";
}
function restartGame() {
history = [];
currentChapterId = "start";
showChapter("start");
restartBtn.style.display = "none";
}
// 初始化
restartBtn.addEventListener("click", restartGame);
showChapter("start");