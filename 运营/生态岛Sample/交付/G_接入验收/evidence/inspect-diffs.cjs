const fs = require('fs');
const base = 'G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/B_作品代码/';
const specMd = fs.readFileSync('G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/A_科学模型/model-spec.md', 'utf8');
const frozen = specMd.match(/## 2\. stepModel 逐字源码[\s\S]*?```js\n([\s\S]*?)```/)[1].trim();

// 1) starter: count TODOs and show each
const starter = fs.readFileSync(base + 'starter/eco-island.html', 'utf8');
const starterSm = starter.match(/function stepModel\(previousState, config\) \{[\s\S]*?\n\}/)[0];
const todos = starterSm.match(/\/\/ TODO\(学生\)[^\n]*/g) || [];
console.log('=== starter TODO count:', todos.length);
todos.forEach((t,i)=>console.log(`  TODO${i+1}: ${t.slice(0,90)}`));
// starter TODO 注释行数 vs frozen 行数
console.log('  starter stepModel lines:', starterSm.split('\n').length, '| frozen lines:', frozen.split('\n').length);

// 2) variants: show the drought-diff lines
const variants = fs.readFileSync(base + 'variants/standard/eco-island.html', 'utf8');
const variantsSm = variants.match(/function stepModel\(previousState, config\) \{[\s\S]*?\n\}/)[0];
console.log('\n=== variants/standard stepModel 全文 ===');
console.log(variantsSm);
