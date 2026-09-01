-- B 站链接到手后：替换 <BV号> 与 <链接>，执行于 D:/data/finestem/finestem.db
UPDATE achievement_cards
SET reflection = reflection || char(10) || char(10) || '## 📺 讲解视频' || char(10) || char(10) || '[拆开一个单词游戏（B 站）](https://www.bilibili.com/video/<BV号>)'
WHERE id = '7a27aa15-ec02-4b00-84bd-2c47111eafdd';
-- 同时可给公开 Demo 挂演示视频（demo 页有播放位）：
UPDATE demos SET demo_video_url = 'https://www.bilibili.com/video/<BV号>' WHERE id = 'demo_ad715dd1';
