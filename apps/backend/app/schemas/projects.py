"""
项目与 SKILL_STATE 数据模型

用途：项目管理、轻项目/标准研学流程、SKILL_STATE 状态机
维护者：AI Agent
links: .trae/documents/api-specs/v1/spec.json
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from .common import AuditFields


# =============================================================================
# SKILL_STATE 完整定义（按接口规格第 4 节）
# =============================================================================

class StageBase(BaseModel):
    """
    阶段基础状态
    """
    status: Literal['locked', 'active', 'completed', 'skipped'] = Field(default='locked', description="阶段状态")
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="阶段数据")


class Stage01BrainstormData(BaseModel):
    """
    Stage 01: 脑暴选题阶段数据
    """
    ideas: List[str] = Field(default_factory=list, description="脑暴候选列表")
    top_picks: List[str] = Field(default_factory=list, description="Top 3 选题")
    selected_idea: Optional[str] = Field(None, description="最终选题")
    brainstorm_rounds: int = Field(default=1, ge=1, description="脑暴轮次")


class Stage02BriefData(BaseModel):
    """
    Stage 02: 开题立项阶段数据
    """
    title: Optional[str] = Field(None, description="项目标题")
    problem_statement: Optional[str] = Field(None, description="问题陈述")
    success_criteria: List[str] = Field(default_factory=list, description="成功标准")
    risks: List[str] = Field(default_factory=list, description="风险清单")
    target_audience: Optional[str] = Field(None, description="目标用户")
    time_budget: Optional[str] = Field(None, description="时间预算")


class Stage03ConstraintsData(BaseModel):
    """
    Stage 03: 范围裁剪阶段数据
    """
    must_have: List[str] = Field(default_factory=list, description="必须做")
    nice_to_have: List[str] = Field(default_factory=list, description="最好有")
    wont_do: List[str] = Field(default_factory=list, description="不做")


class Stage04TrackData(BaseModel):
    """
    Stage 04: 轨道选择阶段数据
    """
    template_id: Literal['web', 'kaggle', 'hardware'] = Field(default='web', description="技术轨道")
    tech_stack: Optional[str] = Field(None, description="技术栈")
    resource_check: Optional[Dict[str, bool]] = Field(default_factory=dict, description="资源检查")


class Stage05DesignData(BaseModel):
    """
    Stage 05: 设计蓝图阶段数据
    """
    ui_sketch: Optional[str] = Field(None, description="UI 设计描述或链接")
    components: List[str] = Field(default_factory=list, description="组件列表")
    acceptance_criteria: List[str] = Field(default_factory=list, description="验收用例")
    code_framework: Optional[str] = Field(None, description="代码框架描述")


class StepPlanItem(BaseModel):
    """
    分步计划项
    """
    name: str = Field(..., description="步骤名称")
    run: str = Field(..., description="执行动作")
    check: str = Field(..., description="验证方式")
    rollback: str = Field(..., description="回滚方案")


class Stage06StepPlanData(BaseModel):
    """
    Stage 06: 分步计划阶段数据
    """
    steps: List[StepPlanItem] = Field(default_factory=list, description="分步计划")


class MilestoneItem(BaseModel):
    """
    里程碑项
    """
    name: str = Field(..., description="里程碑名称")
    completed: bool = Field(default=False, description="是否完成")


class Stage07ExecuteData(BaseModel):
    """
    Stage 07: 执行开发阶段数据
    """
    milestones: List[MilestoneItem] = Field(default_factory=list, description="里程碑")
    dev_log: List[str] = Field(default_factory=list, description="开发日志")
    code_snapshot: Optional[str] = Field(None, description="代码快照链接")


class AcceptanceResultItem(BaseModel):
    """
    验收结果项
    """
    criterion: str = Field(..., description="验收标准")
    passed: bool = Field(..., description="是否通过")


class Stage08EvaluateData(BaseModel):
    """
    Stage 08: 验收展示阶段数据
    """
    acceptance_results: List[AcceptanceResultItem] = Field(default_factory=list, description="验收结果")
    reflections: List[str] = Field(default_factory=list, description="反思")
    achievement_card_id: Optional[str] = Field(None, description="成果档案卡 ID")
    paper_mode: bool = Field(default=False, description="是否生成论文")


class LightToStandardMapping(BaseModel):
    """
    轻项目升级到标准研学的映射记录
    """
    upgraded_at: Optional[datetime] = None
    light_step_1_mapped_to: List[str] = Field(default_factory=list)
    light_step_2_mapped_to: List[str] = Field(default_factory=list)
    light_step_3_mapped_to: List[str] = Field(default_factory=list)


class SkillState(BaseModel):
    """
    完整的 SKILL_STATE 状态机

    兼容平台和 AI IDE，支持轻项目 3 步和标准研学 9 阶段
    """
    version: str = Field(default="1.0.0", description="Schema 版本")
    project_id: str = Field(..., description="项目 ID")
    mode: Literal['light', 'standard'] = Field(default='light', description="项目模式")
    current_stage: Literal[
        'step_1',
        'step_2',
        'step_3',
        'stage_00_bootstrap',
        'stage_01_brainstorm',
        'stage_02_brief',
        'stage_03_constraints',
        'stage_04_track',
        'stage_05_design',
        'stage_06_step_plan',
        'stage_07_execute',
        'stage_08_evaluate'
    ] = Field(default='stage_01_brainstorm', description="当前阶段")
    light_step: Optional[Literal[1, 2, 3]] = Field(None, description="轻项目当前步骤（仅 light 模式用）")
    
    # 各阶段状态
    stages: Dict[str, StageBase] = Field(default_factory=dict, description="各阶段状态")
    
    # 元数据
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")
    light_to_standard_mapping: Optional[LightToStandardMapping] = None
    stage_history: List[Dict[str, Any]] = Field(default_factory=list, description="阶段历史")
    light_step_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="轻项目步骤数据")
    standard_step_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="标准项目阶段数据")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# 轻项目步骤数据
# =============================================================================

class LightProjectStep1Data(BaseModel):
    """
    轻项目 Step 1: 想法与方向
    """
    project_name: Optional[str] = None
    one_liner: Optional[str] = None
    core_features: List[str] = Field(default_factory=list)


class LightProjectStep2Data(BaseModel):
    """
    轻项目 Step 2: 设计与实现
    """
    code_url: Optional[str] = None
    key_screenshots: List[str] = Field(default_factory=list)


class LightProjectStep3Data(BaseModel):
    """
    轻项目 Step 3: 展示与反思
    """
    brief_reflection: Optional[str] = None


class StandardProjectStepData(BaseModel):
    """
    标准项目单步数据
    """
    schema_version: str = Field(default="2.0.0", description="标准阶段数据结构版本")
    goal: Optional[str] = Field(default=None, description="阶段目标（兼容字段）")
    outputs: Optional[str] = Field(default=None, description="阶段产出（兼容字段）")
    notes: Optional[str] = Field(default=None, description="阶段备注（兼容字段）")
    payload: Dict[str, Any] = Field(default_factory=dict, description="结构化阶段表单数据")
    content: Optional[str] = Field(default=None, description="旧版文本字段（向后兼容）")


# =============================================================================
# Project 模型
# =============================================================================

class ProjectBase(BaseModel):
    """
    项目基础字段
    """
    name: str = Field(..., min_length=1, max_length=200, description="项目名称")
    mode: Literal['light', 'standard'] = Field(default='light', description="项目模式")
    from_demo_id: Optional[str] = Field(None, description="来源 Demo ID")
    initial_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="初始数据")


class ProjectCreate(ProjectBase):
    """
    项目创建请求
    """
    pass


class ProjectUpdate(BaseModel):
    """
    项目更新请求
    """
    name: Optional[str] = None
    mode: Optional[Literal['light', 'standard']] = None
    initial_data: Optional[Dict[str, Any]] = Field(default=None, description="项目数据（含代码快照等）")


class FileEntry(BaseModel):
    """
    项目文件条目（多文件支持）
    """
    name: str = Field(..., description="文件名，如 main.py")
    language: str = Field(default="python", description="编程语言")
    content: str = Field(default="", description="文件内容")
    is_main: bool = Field(default=False, description="是否为主文件（运行入口）")


class ProjectCodeSave(BaseModel):
    """
    项目代码保存请求
    """
    code: str = Field(..., description="代码内容（主文件）")
    language: str = Field(default="python", description="编程语言")
    filename: Optional[str] = Field(default=None, description="文件名")
    files: Optional[List[FileEntry]] = Field(default=None, description="多文件列表（可选，保存时覆盖）")


class ProjectChatSave(BaseModel):
    """
    项目聊天记录保存请求
    """
    messages: List[Dict[str, Any]] = Field(..., description="聊天消息列表")


class ProjectUpgradeRequest(BaseModel):
    """
    轻项目升级为标准研学请求
    """
    confirm_upgrade: bool = Field(..., description="确认升级")


class ProjectUpgrade(BaseModel):
    """
    轻项目升级到标准项目请求
    """
    confirm_upgrade: bool = Field(default=True, description="确认升级")
    mapping: Optional[LightToStandardMapping] = None


class LightProjectStepsData(LightProjectStep1Data, LightProjectStep2Data, LightProjectStep3Data):
    """
    合并的轻项目步骤数据
    """
    pass


class ProjectProgress(BaseModel):
    """
    项目进度响应
    """
    current_stage: str
    stage_history: List[Dict[str, Any]]
    light_step_data: Optional[LightProjectStepsData] = None
    standard_step_data: Optional[Dict[str, Any]] = None
    teaching_mode: Literal['guided', 'demo', 'hands_on', 'lecture'] = Field(
        default='guided',
        description="代码讲解教学模式",
    )


class ProjectWorkspaceData(BaseModel):
    code: str = ""
    language: str = "python"
    filename: Optional[str] = None
    chat_messages: List[Dict[str, Any]] = Field(default_factory=list)
    preview_html: str = ""
    saved_at: Optional[str] = None
    chat_saved_at: Optional[str] = None
    files: List[FileEntry] = Field(default_factory=list, description="多文件列表（向后兼容：空列表表示单文件模式）")


class ProjectWorkspaceResponse(BaseModel):
    project: "Project"
    progress: ProjectProgress
    workspace: ProjectWorkspaceData


class ProjectTeachingModeUpdate(BaseModel):
    """
    项目教学模式更新请求
    """
    teaching_mode: Literal['guided', 'demo', 'hands_on', 'lecture'] = Field(
        ...,
        description="教学模式：guided/demo/hands_on/lecture",
    )


class Project(ProjectBase, AuditFields):
    """
    完整项目模型（数据库存储用）
    """
    id: str = Field(description="项目 ID")
    author_id: str = Field(description="作者 ID")
    current_stage: str = Field(default='stage_01_brainstorm', description="当前阶段")
    skill_state: Optional[SkillState] = Field(None, description="SKILL_STATE")
    
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# 成果档案卡（放在独立文件中，这里留引用）
# =============================================================================
# 注：AchievementCard 会在 achievements.py 中定义
