// API 响应基础类型
export interface ApiResponse<T = any> {
  data?: T;
  message: string;
}

// 分页结果类型
export interface PaginationResult<T = any> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 用户类型
export interface UserBase {
  name: string;
  email: string;
  role: 'student';
  level: 1 | 2 | 3;
  capability_tags: string[];
}

export interface UserResponse extends UserBase {
  id: string;
  created_at: string;
}

export interface User extends UserBase {
  id: string;
  password: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by: string;
  updated_by?: string;
}

export interface UserCreate extends UserBase {
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface UserUpdate {
  name?: string;
  capability_tags?: string[];
}

export interface AuthResponse {
  user: UserResponse;
  access_token: string;
  token_type: string;
}

// Demo 类型
export interface Demo {
  id: string;
  name: string;
  description: string;
  tech_stack: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  subjects: string[];
  display_mode: 'iframe' | 'static' | 'step_by_step' | 'single_page' | 'interactive';
  grade_range?: string;
  iframe_url?: string;
  screenshots?: string[];
  demo_video_url?: string;
  project_breakdown?: string;
  minimal_replica?: string;
  code_url?: string;
  download_url?: string;
  fork_template_id?: string;
  content_url?: string;
  tags: string[];
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by: string;
  updated_by?: string;
}

export interface ForkTemplate {
  demo_id: string;
  skeleton_code: string;
  entry_file?: string;
  template_files?: Record<string, string>;
  editable_markers: string[];
  suggestions: string[];
  default_goal: string;
  default_template: string;
}

export interface DemoListQuery {
  page?: number;
  page_size?: number;
  difficulty?: string;
  subject?: string;
  tech_stack?: string;
  search?: string;
}

// 项目类型
export interface ProjectBase {
  name: string;
  description: string;
  mode: 'light' | 'standard';
  from_demo_id?: string;
  display_mode?: 'iframe' | 'static' | 'step_by_step' | 'single_page' | 'interactive';
  tech_stack?: string[];
  subjects?: string[];
}

export interface Project extends ProjectBase {
  id: string;
  author_id: string;
  current_stage?: string;
  is_published: boolean;
  is_public: boolean;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by: string;
  updated_by?: string;
}

export interface ProjectCreate extends ProjectBase {}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  display_mode?: 'iframe' | 'static' | 'step_by_step' | 'single_page' | 'interactive';
  tech_stack?: string[];
  subjects?: string[];
  is_published?: boolean;
  is_public?: boolean;
}

// SKILL_STATE - 研究状态
export const SKILL_STAGES = [
  'stage_00_bootstrap',
  'stage_01_brainstorm',
  'stage_02_brief',
  'stage_03_constraints',
  'stage_04_track',
  'stage_05_design',
  'stage_06_step_plan',
  'stage_07_execute',
  'stage_08_evaluate'
] as const;

export type SkillStage = typeof SKILL_STAGES[number];

export interface LightProjectStep1Data {
  topic: string;
  goal: string;
}

export interface LightProjectStep2Data {
  steps: string[];
}

export interface LightProjectStep3Data {
  result: string;
  reflection: string;
}

export interface StandardProjectStepData {
  schema_version?: string;
  goal?: string;
  outputs?: string;
  notes?: string;
  payload?: Record<string, unknown>;
  content?: string;
}

export interface LightToStandardMapping {
  upgraded_at?: string;
  light_step_1_mapped_to: string[];
  light_step_2_mapped_to: string[];
  light_step_3_mapped_to: string[];
}

export interface ProjectUpgrade {
  confirm_upgrade: boolean;
  mapping?: LightToStandardMapping;
}

export interface ProjectProgress {
  current_stage: SkillStage;
  stage_history: Array<{ stage: SkillStage; started_at: string; completed_at?: string }>;
  light_step_data?: LightProjectStep1Data & LightProjectStep2Data & LightProjectStep3Data;
  standard_step_data?: Record<string, StandardProjectStepData>;
}

export interface SkillState {
  id: string;
  project_id: string;
  current_stage: SkillStage;
  stage_history: Array<{ stage: SkillStage; started_at: string; completed_at?: string }>;
  light_step_data?: LightProjectStep1Data & LightProjectStep2Data & LightProjectStep3Data;
  standard_step_data?: Record<string, StandardProjectStepData>;
  light_to_standard_mapping?: LightToStandardMapping;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
}

// 成就卡片类型
export interface AchievementCard {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  one_liner: string;
  problem_solved: string;
  method_used: string;
  screenshots: string[];
  reflection: string;
  capability_tags: string[];
  project_mode: 'light' | 'standard';
  share_token?: string;
  is_public: boolean;
  visibility: 'private' | 'link' | 'wall';
  shared_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
}

export interface AchievementCardCreate {
  title: string;
  one_liner: string;
  problem_solved: string;
  method_used: string;
  screenshots: string[];
  reflection: string;
  capability_tags: string[];
  project_mode: 'light' | 'standard';
}

export interface AchievementCardUpdate {
  title?: string;
  one_liner?: string;
  problem_solved?: string;
  method_used?: string;
  screenshots?: string[];
  reflection?: string;
  capability_tags?: string[];
  project_mode?: 'light' | 'standard';
  is_public?: boolean;
}

export interface ShareTokenResponse {
  share_token: string;
  share_url: string;
}

export interface SubmitPublicRequest {
  submit_public: boolean;
}

export interface AchievementRecommendation {
  type: 'capability' | 'demo' | 'action';
  id?: string;
  title: string;
  description: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  score?: number;
  target_url?: string;
}

// 证据类型
export interface Evidence {
  id: string;
  project_id: string;
  author_id: string;
  type: 'code_snapshot' | 'video_record' | 'screenshot' | 'text_log' | 'file_upload' | 'auto_stage_change' | 'auto_ai_summary';
  content: string;
  content_url?: string;
  related_step?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
}

export interface EvidenceCreate {
  project_id: string;
  type: 'code_snapshot' | 'video_record' | 'screenshot' | 'text_log' | 'file_upload' | 'auto_stage_change' | 'auto_ai_summary';
  content: string;
  content_url?: string;
  related_step?: string;
}

export interface EvidenceUpdate {
  type?: 'code_snapshot' | 'video_record' | 'screenshot' | 'text_log' | 'file_upload' | 'auto_stage_change' | 'auto_ai_summary';
  content?: string;
  content_url?: string;
  related_step?: string;
}

export interface AutoEvidenceCollectRequest {
  type: 'auto_stage_change' | 'auto_ai_summary';
  content: string;
  related_step?: string;
  source?: 'system' | 'agent' | 'stage_engine';
}

// Skill/Agent 类型
export type SkillPermission =
  | 'project:read'
  | 'project:write'
  | 'evidence:read'
  | 'evidence:write'
  | 'network:read';

export interface SkillManifest {
  skill_id: string;
  name: string;
  version: string;
  description: string;
  entrypoint: string;
  permissions: SkillPermission[];
  timeout_ms: number;
  tags: string[];
  provider_tags: string[];
  requires_approval: boolean;
}

export interface SkillRecord {
  id: string;
  owner_id: string;
  source: 'builtin' | 'marketplace' | 'custom';
  status: 'installed' | 'enabled' | 'disabled';
  manifest: SkillManifest;
  config: Record<string, unknown>;
  install_date: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SkillInstallRequest {
  skill_id: string;
  source: 'builtin' | 'marketplace' | 'custom';
  config?: Record<string, unknown>;
}

export interface AgentToolTrace {
  tool_name: string;
  status: 'success' | 'failed';
  summary: string;
  duration_ms: number;
}

export interface AgentChatRequest {
  message: string;
  context?: Record<string, unknown>;
  project_id?: string;
  session_id?: string;
  enable_tools?: boolean;
  stream?: boolean;
}

export interface AgentChatResponse {
  role: 'assistant';
  content: string;
  trace_id: string;
  session_id: string;
  used_tools: AgentToolTrace[];
  model?: string;
  created_at: string;
}

export interface Course {
  id: string;
  owner_id: string;
  title: string;
  summary: string;
  subject: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  resource_url: string;
  created_at: string;
  updated_at: string;
}

export interface CourseCreate {
  title: string;
  summary?: string;
  subject?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
  resource_url?: string;
}

export interface CapabilityTagSuggestion {
  project_id: string;
  tags: string[];
  reason: string;
}

// 升学与辅导模块类型
export interface HongKongMacaoPlan {
  id: string;
  owner_id: string;
  student_name: string;
  grade: string;
  target_track: 'hk' | 'macao' | 'both';
  timeline: string;
  requirement_summary: string;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface InternationalPlan {
  id: string;
  owner_id: string;
  student_name: string;
  grade: string;
  target_country: string;
  target_school_level: string;
  timeline: string;
  requirement_summary: string;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ProfileEnhancementPlan {
  id: string;
  owner_id: string;
  student_name: string;
  objective: string;
  activities: string[];
  evidence_targets: string[];
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSource {
  id: string;
  owner_id: string;
  title: string;
  source_type: 'article' | 'official' | 'report' | 'video' | 'other';
  url: string;
  summary: string;
  tags: string[];
  reliability_score: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireQuestion {
  id: string;
  text: string;
  question_type: 'single_choice' | 'multi_choice' | 'text';
  required: boolean;
  options: string[];
}

export interface QuestionnaireTemplate {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  questions: QuestionnaireQuestion[];
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireResponse {
  id: string;
  template_id: string;
  respondent_name: string;
  answers: Record<string, string | string[]>;
  completion_rate: number;
  created_at: string;
}

export interface AssistantDialogueSession {
  id: string;
  owner_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantDialogueMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AssistantDialogueChatResponse {
  session: AssistantDialogueSession;
  user_message: AssistantDialogueMessage;
  assistant_message: AssistantDialogueMessage;
  trace_id: string;
  model?: string;
}

export interface AuditLogItem {
  id: string;
  owner_id: string;
  module: string;
  action: string;
  resource_id: string;
  detail: Record<string, string>;
  created_at: string;
}
