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
pptx.title = 'UP 主视频内容分析器 - 研学报告';
pptx.subject = 'STEM项目式学习研学报告';
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
slide1.addText('研学报告', {
    x: 1, y: 3.5, w: 8, h: 0.5,
    fontSize: 20, color: colors.secondary, align: 'center', fontFace: 'Microsoft YaHei'
});
slide1.addText('基于AI的视频内容分析与可视化研究', {
    x: 1, y: 4.2, w: 8, h: 0.5,
    fontSize: 16, color: colors.textDark, align: 'center', fontFace: 'Microsoft YaHei'
});
slide1.addText('2026年3月', {
    x: 1, y: 5, w: 8, h: 0.5,
    fontSize: 16, color: colors.textDark, align: 'center', fontFace: 'Microsoft YaHei'
});

// ===== 第2页：研究背景与动机 =====
let slide2 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide2.addText('研究背景与动机', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

slide2.addText([
    { text: '研究背景', options: { bold: true, fontSize: 20, color: colors.secondary } },
    { text: '随着短视频平台的快速发展，B站、抖音等平台的UP主数量激增。观众在面对海量视频内容时，难以快速了解视频的核心内容；内容创作者也需要分析竞品视频的特点和规律。传统的人工观看和分析方式耗时且主观，亟需一种自动化的视频内容分析工具。', options: { fontSize: 14, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: '研究动机', options: { bold: true, fontSize: 20, color: colors.secondary } },
    { text: '• 探索AI技术在视频内容分析中的应用', options: { fontSize: 14 } },
    { text: '• 研究中文自然语言处理技术', options: { fontSize: 14 } },
    { text: '• 开发实用的视频内容分析工具', options: { fontSize: 14 } },
    { text: '• 提升Web开发与数据可视化能力', options: { fontSize: 14 } }
], { x: 0.5, y: 1.8, w: 9, h: 4.5, color: colors.textDark, fontFace: 'Microsoft YaHei' });

// ===== 第3页：研究问题与目标 =====
let slide3 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide3.addText('研究问题与目标', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

slide3.addText([
    { text: '研究问题', options: { bold: true, fontSize: 20, color: colors.secondary } },
    { text: 'RQ1: 如何高效解析视频字幕并提取关键信息？', options: { fontSize: 14 } },
    { text: 'RQ2: 如何利用中文分词技术提高词频统计准确性？', options: { fontSize: 14 } },
    { text: 'RQ3: 如何设计直观的可视化界面展示分析结果？', options: { fontSize: 14, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: '研究目标', options: { bold: true, fontSize: 20, color: colors.secondary } },
    { text: '• 开发支持多平台的视频字幕提取功能', options: { fontSize: 14 } },
    { text: '• 实现高效的中文分词与停用词过滤', options: { fontSize: 14 } },
    { text: '• 生成美观的词云可视化图表', options: { fontSize: 14 } },
    { text: '• 构建完整的Web应用界面', options: { fontSize: 14 } },
    { text: '• 实现任务管理与历史记录功能', options: { fontSize: 14 } }
], { x: 0.5, y: 1.8, w: 9, h: 4.5, color: colors.textDark, fontFace: 'Microsoft YaHei' });

// ===== 第4页：需求分析 =====
let slide4 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide4.addText('需求分析', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

const requirements = [
    { category: 'Must-Have', items: ['字幕文件上传(SRT/TXT)', '中文分词', '词云生成', '统计面板', '导出报告'], color: colors.primary },
    { category: 'Nice-to-Have', items: ['AI智能总结', '多视频对比', '情感分析', '时间轴分布'], color: colors.secondary },
    { category: 'Won\'t-Do', items: ['视频自动下载字幕', '实时视频分析', '用户账户系统', '云端存储'], color: colors.accent }
];

requirements.forEach((req, idx) => {
    const y = 1.8 + idx * 1.8;
    
    slide4.addText(req.category, {
        x: 0.5, y: y, w: 9, h: 0.4,
        fontSize: 18, bold: true, color: req.color, fontFace: 'Microsoft YaHei'
    });
    
    req.items.forEach((item, iidx) => {
        slide4.addShape(pptx.ShapeType.rect, {
            x: 0.5, y: y + 0.5 + iidx * 0.35, w: 9, h: 0.3,
            fill: { color: '#FFFFFF' },
            line: { color: req.color, width: 1 },
            rectRadius: 0.05
        });
        slide4.addText(item, {
            x: 0.6, y: y + 0.55 + iidx * 0.35, w: 8.8, h: 0.25,
            fontSize: 12, color: colors.textDark, fontFace: 'Microsoft YaHei'
        });
    });
});

// ===== 第5页：技术架构设计 =====
let slide5 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide5.addText('技术架构设计', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

const architecture = [
    { layer: '用户界面层', tech: 'Streamlit', desc: 'Web界面、文件上传、结果展示', color: colors.secondary },
    { layer: '业务逻辑层', tech: 'Python', desc: '任务管理、字幕处理、视频下载', color: colors.accent },
    { layer: '数据处理层', tech: 'jieba/pandas', desc: '中文分词、停用词过滤、词频统计', color: colors.primary },
    { layer: '可视化层', tech: 'wordcloud/matplotlib', desc: '词云生成、图表展示', color: '#FFA500' },
    { layer: '外部服务层', tech: 'API集成', desc: 'B站API、YouTube API、语音识别', color: '#FF8C00' }
];

architecture.forEach((layer, idx) => {
    const y = 1.8 + idx * 1.1;
    
    slide5.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: y, w: 9, h: 1,
        fill: { color: '#FFFFFF' },
        line: { color: layer.color, width: 2 },
        rectRadius: 0.1
    });
    
    slide5.addText(layer.layer, {
        x: 0.7, y: y + 0.15, w: 2.5, h: 0.3,
        fontSize: 16, bold: true, color: layer.color, fontFace: 'Microsoft YaHei'
    });
    
    slide5.addText(layer.tech, {
        x: 0.7, y: y + 0.5, w: 2.5, h: 0.3,
        fontSize: 12, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
    
    slide5.addText(layer.desc, {
        x: 3.5, y: y + 0.2, w: 5.5, h: 0.6,
        fontSize: 13, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
});

// ===== 第6页：技术实现 =====
let slide6 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide6.addText('技术实现', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

const implementations = [
    { name: '字幕解析', desc: '正则表达式提取时间轴和文本，支持SRT/TXT格式', code: 'parse_srt()', color: colors.secondary },
    { name: '中文分词', desc: '使用jieba分词+1000+停用词库，提高准确性', code: 'jieba.lcut()', color: colors.accent },
    { name: '词云生成', desc: '指定中文字体路径，生成美观的词云图', code: 'WordCloud()', color: colors.primary },
    { name: '任务管理', desc: '使用dataclass+JSON持久化，完整状态流转', code: 'TaskManager', color: '#FFA500' }
];

implementations.forEach((impl, idx) => {
    const y = 1.8 + idx * 1.3;
    
    slide6.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: y, w: 0.15, h: 1.1,
        fill: { color: impl.color }
    });
    
    slide6.addText(impl.name, {
        x: 0.8, y: y + 0.15, w: 8.5, h: 0.4,
        fontSize: 18, bold: true, color: impl.color, fontFace: 'Microsoft YaHei'
    });
    
    slide6.addText(impl.desc, {
        x: 0.8, y: y + 0.55, w: 6, h: 0.5,
        fontSize: 14, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
    
    slide6.addText(impl.code, {
        x: 7, y: y + 0.55, w: 2, h: 0.5,
        fontSize: 12, color: impl.color, align: 'center', fontFace: 'Consolas'
    });
});

// ===== 第7页：测试与验证 =====
let slide7 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide7.addText('测试与验证', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

// 左侧：测试用例
slide7.addText('测试用例', {
    x: 0.5, y: 1.8, w: 4.3, h: 0.5,
    fontSize: 20, bold: true, color: colors.secondary, fontFace: 'Microsoft YaHei'
});

const testCases = [
    '页面加载测试',
    'UI元素检查',
    '视频链接输入',
    '任务历史标签',
    '执行报告标签',
    '文件上传功能'
];

testCases.forEach((test, idx) => {
    const y = 2.4 + idx * 0.6;
    slide7.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: y, w: 4.3, h: 0.5,
        fill: { color: '#FFE8D0' },
        line: { color: colors.secondary, width: 1 },
        rectRadius: 0.05
    });
    slide7.addText('✅ ' + test, {
        x: 0.6, y: y + 0.1, w: 4.1, h: 0.3,
        fontSize: 13, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
});

// 右侧：测试结果
slide7.addText('测试结果', {
    x: 5, y: 1.8, w: 4.5, h: 0.5,
    fontSize: 20, bold: true, color: colors.accent, fontFace: 'Microsoft YaHei'
});

slide7.addShape(pptx.ShapeType.rect, {
    x: 5, y: 2.4, w: 4.5, h: 2.5,
    fill: { color: '#FFE8D0' },
    line: { color: colors.accent, width: 2 },
    rectRadius: 0.1
});

slide7.addText('100%', {
    x: 5, y: 2.8, w: 4.5, h: 1,
    fontSize: 60, bold: true, color: colors.accent, align: 'center', fontFace: 'Microsoft YaHei'
});

slide7.addText('6/6 测试用例通过', {
    x: 5, y: 3.9, w: 4.5, h: 0.4,
    fontSize: 16, color: colors.textDark, align: 'center', fontFace: 'Microsoft YaHei'
});

// ===== 第8页：成果展示 =====
let slide8 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide8.addText('成果展示', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

const achievements = [
    { name: '功能完成度', value: '100%', desc: '7个核心功能全部实现', color: colors.primary },
    { name: '测试通过率', value: '100%', desc: '6/6测试用例全部通过', color: colors.secondary },
    { name: '处理性能', value: '<10s', desc: '完整分析流程耗时', color: colors.accent },
    { name: '代码质量', value: '良好', desc: '符合规范，易于维护', color: '#FFA500' }
];

achievements.forEach((ach, idx) => {
    const y = 1.8 + idx * 1.3;
    
    slide8.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: y, w: 9, h: 1.2,
        fill: { color: '#FFFFFF' },
        line: { color: ach.color, width: 2 },
        rectRadius: 0.1
    });
    
    slide8.addText(ach.name, {
        x: 0.7, y: y + 0.2, w: 3, h: 0.3,
        fontSize: 16, bold: true, color: ach.color, fontFace: 'Microsoft YaHei'
    });
    
    slide8.addText(ach.value, {
        x: 0.7, y: y + 0.6, w: 3, h: 0.4,
        fontSize: 28, bold: true, color: ach.color, fontFace: 'Microsoft YaHei'
    });
    
    slide8.addText(ach.desc, {
        x: 4, y: y + 0.3, w: 5, h: 0.6,
        fontSize: 14, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
});

// ===== 第9页：项目反思 =====
let slide9 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide9.addText('项目反思', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

// 左侧：学到的内容
slide9.addText('学到的内容', {
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
    slide9.addShape(pptx.ShapeType.ellipse, {
        x: 0.6, y: y + 0.1, w: 0.25, h: 0.25,
        fill: { color: colors.secondary }
    });
    slide9.addText(item, {
        x: 0.95, y: y + 0.05, w: 3.3, h: 0.15,
        fontSize: 13, color: '#FFFFFF', align: 'center', fontFace: 'Microsoft YaHei'
    });
});

// 右侧：解决的挑战
slide9.addText('解决的挑战', {
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
    
    slide9.addText('⚠️ ' + item.challenge, {
        x: 5, y: y, w: 4.5, h: 0.3,
        fontSize: 13, bold: true, color: '#FF8C00', fontFace: 'Microsoft YaHei'
    });
    slide9.addText('→ ' + item.solution, {
        x: 5.3, y: y + 0.35, w: 4.2, h: 0.3,
        fontSize: 12, color: colors.textDark, fontFace: 'Microsoft YaHei'
    });
});

// ===== 第10页：总结与展望 =====
let slide10 = pptx.addSlide({ masterName: 'MASTER_SLIDE' });
slide10.addText('总结与展望', {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 32, color: colors.primary, bold: true, fontFace: 'Microsoft YaHei'
});

slide10.addText([
    { text: '研究总结', options: { bold: true, fontSize: 20, color: colors.secondary, breakLine: true } },
    { text: '本项目成功开发了一个功能完整的视频内容分析系统，探索了AI技术在视频内容分析中的应用。通过研究中文自然语言处理技术、Web开发和数据可视化技术，实现了从视频字幕提取到词云可视化的完整流程。', options: { fontSize: 14, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: '未来展望', options: { bold: true, fontSize: 20, color: colors.secondary, breakLine: true } },
    { text: '• 集成大模型API，实现AI智能总结功能', options: { fontSize: 14 } },
    { text: '• 支持更多视频平台（快手、小红书等）', options: { fontSize: 14 } },
    { text: '• 添加情感分析和时间轴分布功能', options: { fontSize: 14 } },
    { text: '• 部署到云端，支持多用户访问', options: { fontSize: 14 } },
    { text: '• 优化移动端体验', options: { fontSize: 14 } }
], { x: 0.5, y: 1.8, w: 9, h: 4, color: colors.textDark, fontFace: 'Microsoft YaHei' });

// 底部统计
slide10.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 5.5, w: 9, h: 0.8,
    fill: { color: colors.secondary }
});

slide10.addText('项目完成度: 100%', {
    x: 1, y: 5.6, w: 2.5, h: 0.4,
    fontSize: 24, bold: true, color: '#FFFFFF', fontFace: 'Microsoft YaHei'
});

slide10.addText('测试通过率: 100% (6/6)', {
    x: 4, y: 5.6, w: 2.5, h: 0.4,
    fontSize: 24, bold: true, color: '#FFFFFF', fontFace: 'Microsoft YaHei'
});

slide10.addText('研究价值: 良好', {
    x: 6.5, y: 5.6, w: 2.5, h: 0.4,
    fontSize: 24, bold: true, color: '#FFFFFF', fontFace: 'Microsoft YaHei'
});

// ===== 第11页：感谢页 =====
let slide11 = pptx.addSlide();
slide11.background = { color: colors.background };
slide11.addText('感谢观看', {
    x: 1, y: 2.5, w: 8, h: 1,
    fontSize: 48, color: colors.text, bold: true, align: 'center', fontFace: 'Microsoft YaHei'
});
slide11.addText('UP 主视频内容分析器 - 研学报告', {
    x: 1, y: 3.5, w: 8, h: 0.5,
    fontSize: 20, color: colors.secondary, align: 'center', fontFace: 'Microsoft YaHei'
});
slide11.addText('未来科技学院 | STEM项目式学习', {
    x: 1, y: 5, w: 8, h: 0.5,
    fontSize: 16, color: colors.textDark, align: 'center', fontFace: 'Microsoft YaHei'
});

// 保存文件
pptx.writeFile({ fileName: '研学报告-正式版.pptx' });
console.log('PPT生成完成: 研学报告-正式版.pptx');
