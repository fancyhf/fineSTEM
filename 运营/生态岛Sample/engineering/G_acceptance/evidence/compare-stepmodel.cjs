// G包第二段：B 包六份 HTML stepModel 与 A model-spec §2 冻结源码逐字比对
const fs = require('fs');
const base = 'G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/B_作品代码/';
const files = [
  'reference/eco-island.html',
  'starter/eco-island.html',
  'checkpoints/01-static/eco-island.html',
  'checkpoints/02-single-step/eco-island.html',
  'checkpoints/03-full-control/eco-island.html',
  'variants/standard/eco-island.html',
];
// A 冻结源码（model-spec.md §2，从 ```js 到 ``` 之间）
const specMd = fs.readFileSync('G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/A_科学模型/model-spec.md', 'utf8');
const m = specMd.match(/## 2\. stepModel 逐字源码[\s\S]*?```js\n([\s\S]*?)```/);
if (!m) { console.log('FATAL: cannot extract frozen source from model-spec'); process.exit(1); }
const frozen = m[1].trim();
fs.writeFileSync('G:/tempcache/g-pkg2/frozen-stepmodel.js', frozen);
console.log('Frozen source chars:', frozen.length);

function extractStepModel(html) {
  const re = /function stepModel\(previousState, config\) \{[\s\S]*?\n\}/;
  const mm = html.match(re);
  return mm ? mm[0] : null;
}
for (const f of files) {
  const html = fs.readFileSync(base + f, 'utf8');
  const sm = extractStepModel(html);
  if (!sm) { console.log(`${f}: stepModel NOT FOUND`); continue; }
  const identical = sm === frozen;
  console.log(`${f}: ${identical ? 'IDENTICAL' : 'DIFFERS'}`);
  if (!identical) {
    // char-level diff summary
    let i = 0;
    while (i < Math.min(sm.length, frozen.length) && sm[i] === frozen[i]) i++;
    console.log(`  first diff at char ${i}:`);
    console.log(`  frozen: ...${frozen.slice(Math.max(0,i-30), i+40).replace(/\n/g,'\n')}...`);
    console.log(`  file  : ...${sm.slice(Math.max(0,i-30), i+40).replace(/\n/g,'\n')}...`);
  }
  // check MODEL_VERSION
  const mv = html.match(/MODEL_VERSION\s*=\s*"([^"]+)"/);
  console.log(`  MODEL_VERSION: ${mv ? mv[1] : 'not found'}`);
  // replenishLevel vs replenishRate
  const hasLevel = /replenishLevel/.test(html);
  const hasRate = /replenishRate/.test(html);
  console.log(`  uses replenishLevel: ${hasLevel}, replenishRate: ${hasRate}`);
}
