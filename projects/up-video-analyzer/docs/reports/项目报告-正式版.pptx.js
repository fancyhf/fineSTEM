const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();

// Golden Hour 主题配色
const colors = {
    primary: '#FF8C00',
    secondary: '#FFA500',
    accent: '#FF6B00',
    background: '#FFF8E7',
    text: '#4A4A4A',
    textDark: '#333333'
};

// 设置演示文稿属性
pptx.title = 'UP 主视频内容分析器 - 项目报告';
pptx.subject = 'STEM项目式学习项目报告';
pptx.author = '未来科技学院';

// 定义布局
pptx.defineSlideMaster({
    title: 'MASTER_SLIDE',
    background: { color: colors.background },
    objects: [
        {
            rect: { x: 0, y: 0, w: '100%', h: 0.8, fill: { color: colors.primary } }
        },
        {
            text: {
                text: 'UP 主视频内容分析器',
                options: { x: 0.5, y: 0.15, w: 9, h: 0.5, fontSize: 18, color: colors.text, fontFace: 'Microsoft YaHei' }
            }
        },
        {
            line: { x: 0.5, y: 6.8, w: 9, h: 0, line: { color: colors.secondary, width: 2 } }
        },
        {
            text: {
                text: '未来科技学院 | STEM项目式学习',
                options: { x: 0.5, y: 7, w: 9, h: 0.3, fontSize: 10, color: colors.textDark, fontFace: 'Microsoft YaHei' }
            }
        }
    ]
});

// ===== 第1页：封面 =====
let slide1 = pptx.addSlide();
slide1.background = { color: colors.background };
slide1.addText('UP 主视频内容分析器', {
    x: 1, y: 2.5, w: 8, h: 1,
    fontSize: 44, color: colors.primary, bold: true, align: 'center', fontFace: 'Microsoft YaHei'
});
slide1.addText('项目报告', {
    x: 1, y: 3.5, w: 8, h: 0.5,
    fontSize: 20, color: colors.secondary, align: 'center', fontFace: 'Microsoft YaHei'
});
slide1.addText('2026年3月', {
    x: 1, y: 5, w: 8, h: 0.5,
    fontSize: 16, color: colors.textDark, align: 'center', fontFace: 'Microsoft YaHei'
});

// ===== 第2页：项目概述 =====
let slide2 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide2.addText('项目概述', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

slide2.addText([
    { text: '项目背景', options: { bold: true, fontSize: 20, color: colors.secondary } },
    { text: '随着短视频平台的快速发展，B站、抖音等平台的UP主数量激增。观众在面对海量视频内容时，难以快速了解视频的核心内容；内容创作者也需要分析竞品视频的特点和规律。传统的人工观看和分析方式耗时且主观，亟需一种自动化的视频内容分析工具。', options: { fontSize: 14, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: '项目目标', options: { bold: true, fontSize: 20, color: colors.secondary } },
    { text: '开发一个基于AI的视频内容分析系统，通过分析视频字幕，自动生成词云、统计分析和内容总结，帮助用户快速把握视频核心信息。', options: { fontSize: 14, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: '核心价值', options: { bold: true, fontSize: 20, color: colors.secondary } },
    { text: '• 快速了解UP主内容风格', options: { fontSize: 14 } },
    { text: '• 分析竞品视频特点', options: { fontSize: 14 } },
    { text: '• 发现内容创作规律', options: { fontSize: 14 } }
], { x: 0.5, y: 1.8, w: 9, h: 4.5, color: colors.textDark, fontFace: 'Microsoft YaHei' });

// ===== 第3页：核心功能 =====
let slide3 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide3.addText('核心功能', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

const features = [
    { name: '词云可视化', desc: '直观展示高频词汇', icon: '☁️', color: colors.secondary },
    { name: '数据统计面板', desc: '量化分析内容特征', icon: '📊', color: colors.accent },
    { name: '视频链接分析', desc: '支持B站/抖音/YouTube', icon: '🔗', color: colors.primary },
    { name: '任务管理', desc: '历史记录与状态追踪', icon: '📋', color: '#FF6B00' },
    { name: '导出报告', desc: 'PNG格式导出', icon: '💾', color: '#FF8C00' }
];

features.forEach((feat, idx) => {
    const y = 1.8 + idx * 1.4;
    
    // 功能卡片
    slide3.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: y, w: 9, h: 1.2,
        fill: { color: '#FFFFFF' },
        line: { color: feat.color, width: 2 },
        rectRadius: 0.1
    });
    
    // 图标
    slide3.addText(feat.icon, {
        x: 0.7, y: y + 0.2, w: 0.8, h: 0.8,
        fontSize: 36, align: 'center'
    });
    
    // 标题
    slide3.addText(feat.name, {
        x: 1.7, y: y + 0.2, w: 7, h: 0.4,
        fontSize: 18, bold: true, color: feat.color, fontFace: 'Microsoft YaHei'
    });
    
    // 描述
    slide3.addText(feat.desc, {
        x: 1.7, y: y + 0.6, w: 7, h: 0.5,
        fontSize: 14, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
});

// ===== 第4页：技术架构 =====
let slide4 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide4.addText('技术架构', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

const techStack = [
    { layer: '用户界面层', items: ['Streamlit Web界面', '文件上传组件', '链接输入组件', '结果展示面板'], color: colors.secondary },
    { layer: '业务逻辑层', items: ['任务管理器', '字幕处理器', '视频下载器'], color: colors.accent },
    { layer: '数据处理层', items: ['jieba中文分词', '停用词过滤', '词频统计'], color: colors.primary },
    { layer: '可视化层', items: ['wordcloud词云', 'matplotlib图表', 'pandas数据展示'], color: '#FFA500' },
    { layer: '外部服务层', items: ['B站API', 'YouTube API', 'SiliconFlow语音识别'], color: '#FF8C00' },
    { layer: '数据存储层', items: ['任务数据JSON', '字幕文件TXT/SRT', '分析结果PNG/JSON'], color: '#FF6B00' }
];

techStack.forEach((layer, idx) => {
    const y = 1.8 + idx * 1.3;
    
    // 层标题
    slide4.addText(layer.layer, {
        x: 0.5, y: y, w: 2.5, h: 0.4,
        fontSize: 16, bold: true, color: layer.color, fontFace: 'Microsoft YaHei'
    });
    
    // 组件项
    layer.items.forEach((item, iidx) => {
        slide4.addShape(pptx.ShapeType.rect, {
            x: 2.8, y: y + 0.2 + iidx * 0.35, w: 6.5, h: 0.3,
            fill: { color: '#FFFFFF' },
            line: { color: layer.color, width: 1 },
            rectRadius: 0.05
        });
        slide4.addText(item, {
            x: 2.9, y: y + 0.25 + iidx * 0.35, w: 6.3, h: 0.25,
            fontSize: 11, color: colors.textDark, fontFace: 'Microsoft YaHei'
        });
    });
});

// ===== 第5页：项目成果 =====
let slide5 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide5.addText('项目成果', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

// 左侧：功能完成情况
slide5.addText('功能完成情况', {
    x: 0.5, y: 1.8, w: 4.3, h: 0.5,
    fontSize: 20, bold: true, color: colors.secondary, fontFace: 'Microsoft YaHei'
});

const completions = [
    { name: '字幕文件上传', status: '✅ 完成' },
    { name: '中文分词处理', status: '✅ 完成' },
    { name: '词云生成', status: '✅ 完成' },
    { name: '统计面板', status: '✅ 完成' },
    { name: '视频链接输入', status: '✅ 完成' },
    { name: '任务管理', status: '✅ 完成' },
    { name: '导出报告', status: '✅ 完成' }
];

completions.forEach((item, idx) => {
    const y = 2.4 + idx * 0.5;
    slide5.addText(item.name, {
        x: 0.5, y: y, w: 3.5, h: 0.3,
        fontSize: 14, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
    slide5.addText(item.status, {
        x: 4, y: y, w: 0.5, h: 0.3,
        fontSize: 14, color: colors.secondary, fontFace: 'Microsoft YaHei'
    });
});

// 右侧：测试结果
slide5.addText('测试通过率', {
    x: 5, y: 1.8, w: 4.5, h: 0.5,
    fontSize: 20, bold: true, color: colors.accent, fontFace: 'Microsoft YaHei'
});

slide5.addShape(pptx.ShapeType.rect, {
    x: 5, y: 2.4, w: 4.5, h: 2.5,
    fill: { color: '#FFE8D0' },
    line: { color: colors.accent, width: 2 },
    rectRadius: 0.1
});

slide5.addText('100%', {
    x: 5, y: 2.8, w: 4.5, h: 1,
    fontSize: 60, bold: true, color: colors.accent, align: 'center', fontFace: 'Microsoft YaHei'
});

slide5.addText('6/6 测试用例通过', {
    x: 5, y: 3.9, w: 4.5, h: 0.4,
    fontSize: 16, color: colors.textDark, align: 'center', fontFace: 'Microsoft YaHei'
});

// ===== 第6页：技术亮点 =====
let slide6 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide6.addText('技术亮点', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

const highlights = [
    { title: '中文分词优化', desc: '使用jieba分词 + 1000+停用词库，提高词频统计准确性', color: colors.secondary },
    { title: '任务管理系统', desc: '完整的状态流转：PENDING → DOWNLOADING → EXTRACTING → COMPLETED', color: colors.accent },
    { title: '平台检测', desc: '自动识别B站、抖音、西瓜视频、YouTube等平台', color: colors.primary },
    { title: '自动化测试', desc: 'Playwright端到端测试，100%测试通过率', color: '#FFA500' }
];

highlights.forEach((item, idx) => {
    const y = 1.8 + idx * 1.4;
    
    // 左侧色块
    slide6.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: y, w: 0.15, h: 1.1,
        fill: { color: item.color }
    });
    
    // 标题
    slide6.addText(item.title, {
        x: 0.8, y: y + 0.15, w: 8.5, h: 0.4,
        fontSize: 18, bold: true, color: item.color, fontFace: 'Microsoft YaHei'
    });
    
    // 描述
    slide6.addText(item.desc, {
        x: 0.8, y: y + 0.55, w: 8.5, h: 0.5,
        fontSize: 14, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
});

// ===== 第7页：项目反思 =====
let slide7 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide7.addText('项目反思', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

// 左侧：学到的内容
slide7.addText('学到的内容', {
    x: 0.5, y: 1.8, w: 4.3, h: 0.5,
    fontSize: 20, bold: true, color: colors.secondary, fontFace: 'Microsoft YaHei'
});

const learnings = [
    'Streamlit Web开发框架',
    '中文NLP处理技术',
    '任务管理系统设计',
    '视频处理与字幕提取',
    '自动化测试方法'
];

learnings.forEach((item, idx) => {
    const y = 2.4 + idx * 0.6;
    slide7.addShape(pptx.ShapeType.ellipse, {
        x: 0.6, y: y + 0.1, w: 0.25, h: 0.25,
        fill: { color: colors.secondary }
    });
    slide7.addText(item, {
        x: 0.95, y: y + 0.05, w: 3.3, h: 0.15,
        fontSize: 13, color: '#FFFFFF', align: 'center', fontFace: 'Microsoft YaHei'
    });
});

// 右侧：解决的挑战
slide7.addText('解决的挑战', {
    x: 5, y: 1.8, w: 4.5, h: 0.5,
    fontSize: 20, bold: true, color: colors.accent, fontFace: 'Microsoft YaHei'
});

const challenges = [
    { challenge: 'API调用失败', solution: '改为multipart/form-data格式' },
    { challenge: 'B站视频下载受限', solution: '添加专用headers' },
    { challenge: '中文词云乱码', solution: '指定中文字体路径' },
    { challenge: '任务状态管理复杂', solution: '使用dataclass + JSON持久化' }
];

challenges.forEach((item, idx) => {
    const y = 2.4 + idx * 0.9;
    
    slide7.addText('⚠️ ' + item.challenge, {
        x: 5, y: y, w: 4.5, h: 0.3,
        fontSize: 13, bold: true, color: '#FF8C00', fontFace: 'Microsoft YaHei'
    });
    slide7.addText('→ ' + item.solution, {
        x: 5.3, y: y + 0.35, w: 4.2, h: 0.3,
        fontSize: 12, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
});

// ===== 第8页：下一步计划 =====
let slide8 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide8.addText('下一步计划', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

const nextSteps = [
    { name: '添加AI智能总结功能', priority: '高', time: '2h', color: '#FF8C00' },
    { name: '支持更多视频平台', priority: '中', time: '3h', color: colors.primary },
    { name: '部署到云端服务器', priority: '中', time: '2h', color: colors.secondary },
    { name: '添加用户账户系统', priority: '低', time: '4h', color: colors.accent }
];

nextSteps.forEach((item, idx) => {
    const y = 1.8 + idx * 1.3;
    
    // 优先级标签
    slide8.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: y, w: 1, h: 0.5,
        fill: { color: item.color },
        rectRadius: 0.05
    });
    slide8.addText(item.priority, {
        x: 0.6, y: y + 0.1, w: 0.8, h: 0.3,
        fontSize: 12, bold: true, color: '#FFFFFF', align: 'center', fontFace: 'Microsoft YaHei'
    });
    
    // 功能名称
    slide8.addText(item.name, {
        x: 1.7, y: y + 0.05, w: 7, h: 0.4,
        fontSize: 16, bold: true, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
    
    // 预计时间
    slide8.addText('预计: ' + item.time, {
        x: 1.7, y: y + 0.35, w: 7, h: 0.3,
        fontSize: 13, color: '#888888', fontFace: 'Microsoft YaHei'
    });
});

// ===== 第9页：总结 =====
let slide9 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide9.addText('项目总结', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

slide9.addText([
    { text: '本项目成功开发了一个功能完整的视频内容分析系统，实现了：', options: { fontSize: 16, bold: true, color: colors.secondary, breakLine: true } },
    { text: '• 字幕文件上传与解析', options: { fontSize: 14 } },
    { text: '• 中文分词与停用词过滤', options: { fontSize: 14 } },
    { text: '• 词云生成与可视化', options: { fontSize: 14 } },
    { text: '• 视频链接输入与平台检测', options: { fontSize: 14 } },
    { text: '• 任务管理与历史记录', options: { fontSize: 14 } },
    { text: '• 完整的自动化测试', options: { fontSize: 14, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: '项目按时完成，测试通过率 100%，达到了预期目标。', options: { fontSize: 16, bold: true, color: colors.secondary, breakLine: true } },
    { text: '通过本项目，我掌握了Streamlit Web开发、中文NLP处理、任务管理系统设计、视频处理技术和自动化测试方法。', options: { fontSize: 14, breakLine: true } }
], { x: 0.5, y: 1.8, w: 9, h: 4, color: colors.textDark, fontFace: 'Microsoft YaHei' });

// 底部统计
slide9.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 5.5, w: 9, h: 0.8,
    fill: { color: colors.secondary }
});

slide9.addText('项目完成度: 100%', {
    x: 1, y: 5.6, w: 2.5, h: 0.4,
    fontSize: 24, bold: true, color: '#FFFFFF', fontFace: 'Microsoft YaHei'
});

slide9.addText('测试通过率: 100% (6/6)', {
    x: 4, y: 5.6, w: 2.5, h: 0.4,
    fontSize: 24, bold: true, color: '#FFFFFF', fontFace: 'Microsoft YaHei'
});

slide9.addText('代码质量: 良好', {
    x: 6.5, y: 5.6, w: 2.5, h: 0.4,
    fontSize: 24, bold: true, color: '#FFFFFF', fontFace: 'Microsoft YaHei'
});

// ===== 第10页：感谢页 =====
let slide10 = pptx.addSlide();
slide10.background = { color: colors.background };
slide10.addText('感谢观看', {
    x: 1, y: 2.5, w: 8, h: 1,
    fontSize: 48, color: colors.text, bold: true, align: 'center', fontFace: 'Microsoft YaHei'
});
slide10.addText('UP 主视频内容分析器 - 项目报告', {
    x: 1, y: 3.5, w: 8, h: 0.5,
    fontSize: 20, color: colors.secondary, align: 'center', fontFace: 'Microsoft YaHei'
});
slide10.addText('未来科技学院 | STEM项目式学习', {
    x: 1, y: 5, w: 8, h: 0.5,
    fontSize: 16, color: colors.textDark, align: 'center', fontFace: 'Microsoft YaHei'
});

// 保存文件
pptx.writeFile({ fileName: '项目报告-正式版.pptx' });
console.log('PPT生成完成: 项目报告-正式版.pptx');
