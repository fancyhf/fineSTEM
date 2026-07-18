// 奇幻选择之旅 —— 故事数据
const STORY_DATA = {
chapters: [
{
id: "start",
title: "序章 · 迷雾森林",
text: "你站在一片浓雾笼罩的森林入口，眼前有两条小路。\n一条铺满落叶、蜿蜒幽静；另一条石块整齐、通向远方的微光。\n你选择哪一条路？",
image: "forest",
options: [
{ text: "🍂 走落叶小径", next: "cabin" },
{ text: "✨ 走石板路", next: "lake" }
]
},
{
id: "cabin",
title: "林中木屋",
text: "沿着落叶小径走了不久，你发现一座亮着灯的破旧木屋。\n门虚掩着，里面传来叮当的敲打声。\n你会怎么做？",
image: "cabin",
options: [
{ text: "🚪 推门进去看", next: "smith" },
{ text: "🪟 绕到屋后偷看", next: "garden" }
]
},
{
id: "lake",
title: "月光湖畔",
text: "石板路的尽头是一片宁静的湖泊，月光洒在水面上。\n湖边停着一艘小木船，旁边立着一块古老的石碑。\n你选择？",
image: "lake",
options: [
{ text: "🛶 划船到湖心小岛", next: "good_ending" },
{ text: "📜 仔细阅读石碑", next: "bad_ending" }
]
},
{
id: "smith",
title: "铁匠的请求",
text: "屋里是一位独眼的铁匠，他看到你后放下铁锤。\n“年轻人，你来得正好。我的风箱坏了，能帮我去后院拿块新皮料吗？”\n你愿意帮忙吗？",
image: "forge",
options: [
{ text: "✅ 帮忙拿皮料", next: "good_ending" },
{ text: "❌ 婉拒并离开", next: "bad_ending" }
]
},
{
id: "garden",
title: "神秘花园",
text: "屋后竟然是一片被施了魔法的花园，花朵发出柔和的荧光。\n花园中央有一口井，井水泛着星光。\n你忍不住伸手触碰井水……",
image: "garden",
options: [
{ text: "💧 用井水洗脸", next: "good_ending" },
{ text: "🔙 退回木屋前门", next: "bad_ending" }
]
}
],
endings: [
{
id: "good_ending",
title: "✨ 好结局 · 星光祝福",
text: "你触动了森林深处的古老祝福，获得了一颗永不熄灭的星光宝石。\n从此，你成为了这片奇幻森林的守护者，日夜都有小精灵围绕着你。",
image: "good",
is_ending: true
},
{
id: "bad_ending",
title: "💔 普通结局 · 归于平凡",
text: "你的选择让你错过了森林的馈赠。天亮了，雾散了，你走出森林回到了普通的世界。\n虽然那段奇幻经历像梦一样模糊，但你心里知道——它真实存在过。",
image: "bad",
is_ending: true
}
]
};