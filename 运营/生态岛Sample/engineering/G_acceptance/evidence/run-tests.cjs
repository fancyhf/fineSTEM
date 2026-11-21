// G包：用 A test-cases.json 复核 B reference 的 stepModel（A HANDOFF §6 建议 G 这样做）
const fs = require('fs');
const html = fs.readFileSync('G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/B_作品代码/reference/eco-island.html', 'utf8');
const sm = html.match(/function stepModel\(previousState, config\) \{[\s\S]*?\n\}/)[0];
const stepModel = new Function(sm + '\nreturn stepModel;')();
const tc = JSON.parse(fs.readFileSync('G:/mediaProjects/fineSTEM/运营/生态岛Sample/交付/A_科学模型/test-cases.json', 'utf8'));
let pass = 0, fail = 0;
for (const c of tc.cases) {
  if (c.id === 'TC09') {
    // 60步
    let s = { step: 0, grass: 60, herbivores: 20, water: 50 };
    const cfg = { environment: { replenishLevel: c.input.replenishLevel }, maxSteps: c.input.maxSteps };
    let traj = [ { ...s } ];
    for (let i = 0; i < 60; i++) { s = stepModel(s, cfg); traj.push({ ...s }); }
    const final = traj[60];
    const exp = c.expected_runtime;
    const ok = final.step === exp.step && Math.abs(final.grass - exp.grass) <= 0.01 && final.herbivores === exp.herbivores && Math.abs(final.water - exp.water) <= 0.01;
    // key steps check
    let keyOk = true;
    for (const k of c.runtime_key_steps) {
      const t = traj[k.step];
      if (!t || Math.abs(t.grass - k.grass) > 0.01 || t.herbivores !== k.herbivores || Math.abs(t.water - k.water) > 0.01) { keyOk = false; console.log(`  TC09 key step mismatch at ${k.step}: got`, t); }
    }
    console.log(`TC09: final ${final.grass}/${final.herbivores}/${final.water} vs expected ${exp.grass}/${exp.herbivores}/${exp.water} => ${ok ? 'PASS' : 'FAIL'}; key steps: ${keyOk ? 'ALL MATCH (9 points incl. S9 0.4/0/41.9, S34 50.4/2/100)' : 'MISMATCH'}`);
    ok && keyOk ? pass++ : fail++;
    continue;
  }
  if (c.id === 'TC10') {
    const s0 = c.input.stateIn;
    const out = stepModel(s0, { environment: { replenishLevel: c.input.replenishLevel }, maxSteps: c.input.maxSteps });
    const exp = c.expected_runtime;
    const ok = out.step === exp.step && Math.abs(out.grass - exp.grass) <= 0.01 && out.herbivores === exp.herbivores && Math.abs(out.water - exp.water) <= 0.01;
    console.log(`${c.id}: got step=${out.step} ${out.grass}/${out.herbivores}/${out.water} => ${ok ? 'PASS' : 'FAIL'} (模型层不停机, maxSteps=${c.input.maxSteps})`);
    ok ? pass++ : fail++;
    continue;
  }
  let s = { step: c.input.initialState.step, grass: c.input.initialState.grass, herbivores: c.input.initialState.herbivores, water: c.input.initialState.water };
  const cfg = { environment: { replenishLevel: c.input.replenishLevel }, maxSteps: c.input.maxSteps };
  for (let i = 0; i < c.input.steps; i++) s = stepModel(s, cfg);
  const exp = c.expected_runtime;
  const ok = s.step === exp.step && Math.abs(s.grass - exp.grass) <= 0.01 && s.herbivores === exp.herbivores && Math.abs(s.water - exp.water) <= 0.01;
  console.log(`${c.id}: got ${s.grass}/${s.herbivores}/${s.water} (step ${s.step}) vs ${exp.grass}/${exp.herbivores}/${exp.water} => ${ok ? 'PASS' : 'FAIL'}`);
  ok ? pass++ : fail++;
}
console.log(`\nSUMMARY: ${pass}/${tc.cases.length} pass, ${fail} fail (B reference vs A test-cases, G 独立复跑)`);
