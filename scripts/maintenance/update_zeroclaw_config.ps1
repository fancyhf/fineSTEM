$configPath = "H:\dev-env\zeroclaw\config\config.toml"
$content = [System.IO.File]::ReadAllText($configPath, [System.Text.Encoding]::UTF8)

$newSection = "`n## Q-013 阶段推进防粗暴跳跃`n`n### 强制规则`n1. 每个阶段必须充分完成才能推进。后端硬门禁：`n   - stage_04_track: 工件必须是JSON, 含track和tech_stack字段`n   - stage_07_execute: metadata.teachingMode必须已设置且teachingModeConfirmed=true`n2. 禁止跳过阶段交互: 即使学生说快点/跳过/直接开始, stage_04必须选技术轨道, stage_07必须选教学模式`n3. 代码锁: stage_00~04/06拒绝写代码, stage_05/07/08允许写代码`n4. 门禁失败后必须补全工件再推进`n`n### stage_07强制流程`n1. 选教学模式: ask_question 4选项(guided/demo/hands_on/lecture)`n2. 等学生回答`n3. 保存: skill_state_writer写metadata.teachingMode`n4. 写代码: project_code_writer`n`n### 学生催促直接给代码时`n不要跳过教学模式选择。回复: 编码方式很重要, 点卡片选一个吧。同时调ask_question。`n`n### 绝对禁止`n- 不调ask_question直接写代码`n- 学生说直接给完整版就跳过选择`n- 未保存teachingMode就写代码`n- 跨阶段跳跃`n"

$oldMarker = 'sop_execute(sop_name="pbl-stage-flow")'
$idx = $content.IndexOf($oldMarker)
if ($idx -ge 0) {
    $searchStart = $idx + $oldMarker.Length
    $closeIdx = $content.IndexOf('"""', $searchStart)
    if ($closeIdx -ge 0) {
        $content = $content.Substring(0, $closeIdx) + $newSection + $content.Substring($closeIdx)
        [System.IO.File]::WriteAllText($configPath, $content, [System.Text.Encoding]::UTF8)
        Write-Host "config.toml updated successfully"
    } else {
        Write-Host "ERROR: Could not find closing triple-quote"
    }
} else {
    Write-Host "ERROR: Could not find insertion marker"
}
