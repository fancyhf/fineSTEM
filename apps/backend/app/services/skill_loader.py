"""
Skill 动态加载器 - 从磁盘加载可插拔的 SKILL.md 文件

用途：解析 .trae/skills/*/SKILL.md，提取完整的 Skill 定义
维护者：AI Agent
links: .trae/documents/产品与规划/fineSTEM_AI对话流设计规格_v1.0.0.md

支持：
- 从磁盘加载 SKILL.md（Markdown + YAML frontmatter）
- 解析完整的阶段定义、状态机、工件规范
- 提取触发词、子技能、AskUserQuestion 模板
- 热重载（修改 SKILL.md 后自动更新）
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class SubSkillDef:
    """子技能定义（从 SKILL.md 的阶段定义解析）"""
    stage_id: str
    name: str
    description: str
    triggers: List[str]
    output_artifacts: List[str]
    gate_conditions: List[str]
    ask_user_questions: List[Dict[str, Any]]
    content: str  # 原始 Markdown 内容


@dataclass
class SkillManifest:
    """Skill 元信息（从 YAML frontmatter 解析）"""
    skill_id: str
    name: str
    description: str
    version: str = "1.0.0"
    language: str = "zh-CN"
    entrypoint: str = ""
    tags: List[str] = field(default_factory=list)
    file_path: str = ""
    loaded_at: str = ""
    content_hash: str = ""


@dataclass
class LoadedSkill:
    """完整加载的 Skill 定义"""
    manifest: SkillManifest
    full_content: str  # 完整的 SKILL.md 内容（用于 system prompt）
    base_system_prompt: str  # 提取的核心 prompt（不含具体阶段）
    stages: Dict[str, SubSkillDef]  # 阶段 -> 子技能映射
    triggers: List[str]  # 所有触发词
    resource_libraries: Dict[str, Any]  # 资源库（题库等）
    templates: Dict[str, str]  # 文档模板
    state_machine_spec: Dict[str, Any]  # 状态机规范


class SkillLoader:
    """
    Skill 动态加载器
    
    从 .trae/skills/*/SKILL.md 加载可插拔的 Skill 定义
    支持热重载和缓存
    """
    
    def __init__(self, skills_base_dir: Optional[str] = None):
        """
        初始化 Skill 加载器
        
        Args:
            skills_base_dir: Skills 目录根路径，默认为 .trae/skills/
        """
        if skills_base_dir is None:
            project_root = Path(__file__).parent.parent.parent.parent.parent
            self.skills_base_dir = project_root / ".trae" / "skills"
        else:
            self.skills_base_dir = Path(skills_base_dir)
        
        self._cache: Dict[str, LoadedSkill] = {}
        self._hash_cache: Dict[str, str] = {}
    
    def discover_skills(self) -> List[Path]:
        """
        发现所有可用的 Skill 目录
        
        Returns:
            包含 SKILL.md 的目录列表
        """
        skill_dirs = []
        
        if not self.skills_base_dir.exists():
            return skill_dirs
        
        for skill_dir in self.skills_base_dir.iterdir():
            if skill_dir.is_dir():
                skill_file = skill_dir / "SKILL.md"
                if skill_file.exists():
                    skill_dirs.append(skill_dir)
        
        return skill_dirs
    
    def _compute_content_hash(self, content: str) -> str:
        """计算内容哈希，用于检测变更"""
        import hashlib
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def _parse_frontmatter(self, content: str) -> tuple[Dict[str, Any], str]:
        """
        解析 YAML frontmatter
        
        Args:
            content: 完整的 Markdown 内容
            
        Returns:
            (frontmatter_dict, remaining_content)
        """
        frontmatter_pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
        match = re.match(frontmatter_pattern, content, re.DOTALL)
        
        if match:
            try:
                import yaml
                fm = yaml.safe_load(match.group(1)) or {}
                return fm, match.group(2)
            except ImportError:
                pass
        
        return {}, content
    
    def _extract_stage_definitions(self, content: str) -> Dict[str, SubSkillDef]:
        """
        从 SKILL.md 内容中提取所有阶段定义
        
        Args:
            content: SKILL.md 的完整内容
            
        Returns:
            阶段 ID -> 子技能定义的映射
        """
        stages = {}
        
        pattern = r'## 阶段\s+(\d+):\s*(.+?)\s*\(stage_(\d+)_[^\)]+\)\s*\n(.*?)(?=\n## 阶段|\n## 导航|\n## 启动指令|\Z)'
        
        matches = re.findall(pattern, content, re.DOTALL)
        
        for stage_num, stage_name, stage_id_suffix, stage_content in matches:
            stage_id = f"stage_{stage_num.zfill(2)}_{stage_id_suffix}"
            
            triggers = self._extract_triggers_from_content(stage_content, stage_name)
            artifacts = self._extract_output_artifacts(stage_content)
            gates = self._extract_gate_conditions(stage_content)
            questions = self._extract_ask_user_questions(stage_content)
            
            sub_skill = SubSkillDef(
                stage_id=stage_id,
                name=stage_name.strip(),
                description=self._extract_description(stage_content),
                triggers=triggers,
                output_artifacts=artifacts,
                gate_conditions=gates,
                ask_user_questions=questions,
                content=stage_content.strip()
            )
            
            stages[stage_id] = sub_skill
        
        return stages
    
    def _extract_triggers_from_content(self, content: str, stage_name: str) -> List[str]:
        """从阶段内容中提取触发词"""
        triggers = []
        
        trigger_match = re.search(r'\*\*触发\*\*:\s*"([^"]+)"', content)
        if trigger_match:
            raw_triggers = trigger_match.group(1)
            triggers = [t.strip() for t in raw_triggers.split('、') if t.strip()]
        
        if not triggers:
            triggers.append(stage_name.strip())
        
        return triggers
    
    def _extract_output_artifacts(self, content: str) -> List[str]:
        """提取输出工件"""
        artifacts = []
        output_match = re.search(r'\*\*输出\*\*:\s*`?([^`\n]+)`?', content)
        if output_match:
            raw = output_match.group(1)
            artifacts = [a.strip() for a in raw.split(' + ') if a.strip()]
        return artifacts
    
    def _extract_gate_conditions(self, content: str) -> List[str]:
        """提取通过门禁条件"""
        gates = []
        gate_match = re.search(r'\*\*通过条件\*\*:\s*(.+)', content)
        if gate_match:
            gates.append(gate_match.group(1).strip())
        return gates
    
    def _extract_ask_user_questions(self, content: str) -> List[Dict[str, Any]]:
        """提取 AskUserQuestion JSON 块"""
        questions = []
        
        json_pattern = r'```json\s*(\{[^`]+?\})\s*```'
        for match in re.finditer(json_pattern, content):
            try:
                q = json.loads(match.group(1))
                if 'questions' in q:
                    questions.append(q)
            except json.JSONDecodeError:
                continue
        
        return questions
    
    def _extract_description(self, content: str) -> str:
        """提取阶段描述（第一行目标）"""
        target_match = re.search(r'\*\*目标\*\*:\s*(.+)', content)
        if target_match:
            return target_match.group(1).strip()
        return ""
    
    def _extract_all_triggers(self, content: str, manifest: SkillManifest) -> List[str]:
        """提取所有触发词（包括启动指令）"""
        triggers = []
        
        startup_section = re.search(r'## 启动指令\s*\n(.*?)(?=\n---|\Z)', content, re.DOTALL)
        if startup_section:
            startup_lines = re.findall(r'-\s*"([^"]+)"', startup_section.group(1))
            triggers.extend(startup_lines)
        
        nav_section = re.search(r'## 导航命令\s*\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
        if nav_section:
            nav_table = re.findall(r'\|\s*"([^"]+)"', nav_section.group(1))
            triggers.extend(nav_table)
        
        if not triggers:
            triggers = [
                "我想做一个项目", "创建新项目", "开始脑爆",
                manifest.name, manifest.description[:20]
            ]
        
        return triggers
    
    def _extract_resource_libraries(self, content: str) -> Dict[str, Any]:
        """提取资源库（题库等）"""
        libraries = {}
        
        lib_sections = re.findall(r'### (Web 项目题库|Kaggle/建模题库|硬件创客题库)[^\n]*\n(.*?)(?=\n### |\n---|\Z)', content, re.DOTALL)
        
        for title, table_content in lib_sections:
            key = title.replace('题库', '').strip().lower()
            libraries[key] = table_content.strip()
        
        return libraries
    
    def _extract_state_machine_spec(self, content: str) -> Dict[str, Any]:
        """提取状态机规范"""
        spec = {}
        
        state_section = re.search(r'## SKILL_STATE.json 状态机规范\s*\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
        if state_section:
            spec['raw'] = state_section.group(1)[:2000]
        
        stage_map_section = re.search(r'## 阶段与工件映射\s*\n(.*?)(?=\n## |\Z)', content, re.DOTALL)
        if stage_map_section:
            spec['stage_artifact_map'] = stage_map_section.group(1)[:1000]
        
        return spec
    
    def load_skill(self, skill_path: Path) -> Optional[LoadedSkill]:
        """
        加载单个 Skill
        
        Args:
            skill_path: SKILL.md 文件路径
            
        Returns:
            加载的 Skill 定义，失败返回 None
        """
        try:
            with open(skill_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            content_hash = self._compute_content_hash(content)
            
            cache_key = str(skill_path)
            if cache_key in self._cache and self._hash_cache.get(cache_key) == content_hash:
                return self._cache[cache_key]
            
            frontmatter, body = self._parse_frontmatter(content)
            
            skill_id = frontmatter.get('name', skill_path.parent.name)
            manifest = SkillManifest(
                skill_id=skill_id,
                name=frontmatter.get('name', skill_id),
                description=frontmatter.get('description', ''),
                version=frontmatter.get('version', '1.0.0'),
                language=frontmatter.get('language', 'zh-CN'),
                entrypoint=f"{skill_path.parent.name}/SKILL.md",
                tags=frontmatter.get('tags', ['pbl']),
                file_path=str(skill_path),
                loaded_at=datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.fffZ'),
                content_hash=content_hash,
            )
            
            stages = self._extract_stage_definitions(content)
            triggers = self._extract_all_triggers(content, manifest)
            libraries = self._extract_resource_libraries(content)
            state_spec = self._extract_state_machine_spec(content)
            
            base_prompt = self._build_base_prompt(manifest, content)
            
            loaded = LoadedSkill(
                manifest=manifest,
                full_content=content,
                base_system_prompt=base_prompt,
                stages=stages,
                triggers=triggers,
                resource_libraries=libraries,
                templates={},
                state_machine_spec=state_spec,
            )
            
            self._cache[cache_key] = loaded
            self._hash_cache[cache_key] = content_hash
            
            return loaded
            
        except Exception as e:
            print(f"[SkillLoader] 加载 Skill 失败 {skill_path}: {e}")
            return None
    
    def _build_base_prompt(self, manifest: SkillManifest, content: str) -> str:
        """
        构建 base system prompt
        
        使用完整的 SKILL.md 内容，但去除代码示例以节省 token
        """
        lines = content.split('\n')
        prompt_lines = []
        in_code_block = False
        code_block_count = 0
        max_code_blocks = 3
        
        for line in lines:
            if line.strip().startswith('```'):
                in_code_block = not in_code_block
                if in_code_block:
                    code_block_count += 1
                    if code_block_count > max_code_blocks:
                        continue
                    prompt_lines.append(line)
                else:
                    if code_block_count <= max_code_blocks:
                        prompt_lines.append(line)
                continue
            
            if in_code_block and code_block_count > max_code_blocks:
                continue
            
            prompt_lines.append(line)
        
        full_text = '\n'.join(prompt_lines)
        
        header = f"""=== {manifest.name} (v{manifest.version}) ===
描述: {manifest.description}
语言: {manifest.language}
文件: {manifest.file_path}
加载时间: {manifest.loaded_at}

"""

        xml_format_instruction = """

---

## ⚠️ 重要：提问格式要求（必须遵守）

当需要向学生提问让学生选择时（如选题方向、技术栈、难度等），**必须使用以下 XML 格式**，前端会自动渲染为交互式选择题卡片：

```xml
<question>
<title>你想做什么类型的项目？</title>
<subtitle>请从以下选项中选择</subtitle>
<option id="web"><label>Web应用（推荐）</label><desc>网站、网页工具等</desc></option>
<option id="data"><label>数据分析</label><desc>数据可视化、统计图表</desc></option>
<option id="game"><label>小游戏</label><desc>猜数字、贪吃蛇等</desc></option>
</question>
```

**规则**：
1. 每次给 3-5 个选项，可标注"推荐"
2. 多选用 `multiple="true"` 属性
3. 可用 `step="N" total="M"` 表示第几步
4. 用户选择后自动作为下一条消息继续对话
5. **禁止在 question 标签外重复文字描述选项内容**
6. **禁止使用 JSON 格式的 AskUserQuestion**，只使用上面的 XML 格式
7. 回复中最多包含一个 `<question>` 块

## 语言风格要求
- **禁止重复词语**：不要说"很好很好""太好了太好了"，每个词只说一次
- **简洁明了**：用短句，每句话表达一个意思
- **自然流畅**：像真人老师对话一样，不要机械重复
- **适度使用 Emoji**：每段最多 2-3 个，不要堆砌

## ⚠️ 首次对话规则（高优先级，但不得阻塞执行）
当用户**第一次**表达想做项目时（如"我想做个项目"、"创建新项目"、"帮我做一个XXX"），默认先通过 `<question>` 询问基础信息，但下面这些情况**禁止继续卡在起始三连问**：

- 如果聊天历史、当前上下文或当前消息里，已经明确出现年级、时间预算、初步想法中的任意项，只能追问缺失项，禁止重复追问已确认内容。
- 如果年级、时间预算、初步想法三项已经齐全，必须继续推进到创意收敛、MVP 方案、技术路线与语言选择，禁止继续停留在重复开题提问；只有用户明确要求跳过引导，或流程已经进入执行阶段时，才直接输出代码。
- 如果用户明确表达“直接做 / 直接实现 / 直接进入编码 / 直接给代码 / 写入编辑器 / 不要再问”，必须立即停止起始提问；默认先给出创意方案、方向选择或可执行下一步，只有在用户明确要求跳过引导直达编码，或当前已经处于执行/验收阶段时，才直接输出代码。
- 如果用户明确指定技术形态（如网页、HTML/CSS/JavaScript、Python、JS 小游戏），必须跟随该形态，不要擅自改成别的语言或命令行版本。

1. **第一步必须问**：年级/年龄（初中/高中）→ 用 question 弹出选项
2. **第二步问**：时间预算（2小时/6小时/12小时+）
3. **第三步问**：是否有初步想法（没想法/有方向/有具体想法）

只有在以上豁免条件都不满足时，才按照这三步完成基础信息采集。
如果聊天历史、当前上下文、或学生刚刚的回答里已经明确给出了其中某些信息，**禁止重复追问**，应直接继续问缺失项或推进到下一阶段。
一旦这三项收集完成，就**禁止**再次回到“年级 / 时间预算 / 初步想法”这三个起始问题。

**违反此规则的后果**：学生体验极差，直接跳过需求分析会导致项目不符合学生水平。
"""
        
        return header + full_text + xml_format_instruction
    
    def load_all_skills(self) -> Dict[str, LoadedSkill]:
        """
        加载所有可用的 Skill
        
        Returns:
            Skill ID -> LoadedSkill 的映射
        """
        skill_dirs = self.discover_skills()
        
        for skill_dir in skill_dirs:
            skill_file = skill_dir / "SKILL.md"
            loaded = self.load_skill(skill_file)
            if loaded:
                print(f"[SkillLoader] [OK] 已加载: {loaded.manifest.skill_id} ({loaded.manifest.name})")
        
        return self._cache
    
    def get_skill(self, skill_id: str) -> Optional[LoadedSkill]:
        """
        获取已加载的 Skill
        
        Args:
            skill_id: Skill ID
            
        Returns:
            LoadedSkill 或 None
        """
        if skill_id in self._cache:
            cached = self._cache[skill_id]
            skill_path = Path(cached.manifest.file_path)
            if skill_path.exists():
                refreshed = self.load_skill(skill_path)
                return refreshed
        
        for skill_dir in self.discover_skills():
            if skill_dir.name == skill_id or skill_dir.stem == skill_id:
                skill_file = skill_dir / "SKILL.md"
                return self.load_skill(skill_file)
        
        return None
    
    def reload_skill(self, skill_id: str) -> Optional[LoadedSkill]:
        """
        重载指定 Skill（强制刷新缓存）
        
        Args:
            skill_id: Skill ID
            
        Returns:
            重载后的 LoadedSkill
        """
        cache_key = None
        for k, v in self._cache.items():
            if v.manifest.skill_id == skill_id:
                cache_key = k
                break
        
        if cache_key:
            del self._cache[cache_key]
            self._hash_cache.pop(cache_key, None)
        
        for skill_dir in self.discover_skills():
            if skill_dir.name == skill_id:
                skill_file = skill_dir / "SKILL.md"
                return self.load_skill(skill_file)
        
        return None
    
    def list_available_skills(self) -> List[Dict[str, Any]]:
        """
        列出所有可用 Skill 的摘要信息（用于 API）
        
        Returns:
            Skill 摘要列表
        """
        self.load_all_skills()
        
        result = []
        for loaded in self._cache.values():
            result.append({
                'skill_id': loaded.manifest.skill_id,
                'name': loaded.manifest.name,
                'description': loaded.manifest.description,
                'version': loaded.manifest.version,
                'tags': loaded.manifest.tags,
                'stage_count': len(loaded.stages),
                'trigger_count': len(loaded.triggers),
                'loaded_at': loaded.manifest.loaded_at,
                'file_path': loaded.manifest.file_path,
            })
        
        return result


# 全局单例
_skill_loader_instance: Optional[SkillLoader] = None


def get_skill_loader() -> SkillLoader:
    """获取全局 SkillLoader 单例"""
    global _skill_loader_instance
    if _skill_loader_instance is None:
        _skill_loader_instance = SkillLoader()
    return _skill_loader_instance


def load_stem_pbl_skill() -> Optional[LoadedSkill]:
    """快捷方法：加载 STEM PBL Skill"""
    loader = get_skill_loader()
    return loader.get_skill("stem-pbl-guide")
