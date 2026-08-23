// API 响应基础类型
export interface ApiResponse<T = unknown> {
  data?: T;
  message: string;
}

// 分页结果类型
export interface PaginationResult<T = unknown> {
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
  role: 'student' | 'admin';
  level: 1 | 2 | 3 | 4 | 5;
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

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
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
  explanation_doc?: string;
  minimal_replica?: string;
  code_url?: string;
  download_url?: string;
  fork_template_id?: string;
  // 2026-08-03：收录来源项目（admin 把合格 project 收录为 demo 时写入）
  source_project_id?: string;
  content_url?: string;
  tags: string[];
  is_published: boolean;
  // 2026-08-03：后端 PublishFields 实际返回的是 is_public（非 is_published）
  is_public?: boolean;
  submitted_at?: string;
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

// 2026-08-03：admin 把项目收录为 Demo 的表单数据（demo 独有字段）。
// name/description/screenshots 由后端从 project + 成果卡映射，这里只传 demo 独有字段。
export interface DemoCreateFromProject {
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  subjects: string[];
  grade_range: string;
  code_url: string;
  download_url: string;
  tech_stack?: string[];
  tags?: string[];
  display_mode?: 'iframe' | 'static';
  iframe_url?: string;
  demo_video_url?: string;
  project_breakdown?: string;
  explanation_doc?: string;
  minimal_replica?: { entry_file?: string; files?: Record<string, string> } | null;
  is_public?: boolean;
}

// 项目 → Demo 预填充数据（后端从 project/成果卡/skill_state/workspace 自动提取）
export interface DemoPrefill {
  name: string;
  description: string;
  screenshots: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  subjects: string[];
  grade_range: string;
  tech_stack: string[];
  tags: string[];
  display_mode: 'iframe' | 'static';
  iframe_url?: string | null;
  code_url: string;
  download_url: string;
  project_breakdown?: string | null;
  explanation_doc?: string | null;
  minimal_replica?: { entry_file?: string; files?: Record<string, string> } | null;
  is_public: boolean;
  // 额外诊断信息
  source_track?: string | null;
  has_workspace_code: boolean;
}

// Demo 编辑（全字段可选）
export interface DemoUpdate {
  name?: string;
  description?: string;
  tech_stack?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  subjects?: string[];
  grade_range?: string;
  tags?: string[];
  display_mode?: 'iframe' | 'static';
  iframe_url?: string;
  screenshots?: string[];
  demo_video_url?: string;
  project_breakdown?: string;
  explanation_doc?: string;
  minimal_replica?: { entry_file?: string; files?: Record<string, string> } | null;
  code_url?: string;
  download_url?: string;
  source_project_id?: string;
}

// 项目类型
export interface ProjectBase {
  name: string;
  description?: string;
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
  
  // 可见性和精选相关字段
  visibility: 'private' | 'link' | 'public';
  is_featured_demo: boolean;
  featured_demo_sort_order: number;
  featured_demo_at?: string;
  is_featured_work: boolean;
  featured_work_sort_order: number;
  featured_work_at?: string;
  
  // 关联成果档案卡摘要（精选管理/首页 Demo 展示用）
  achievement_card_id?: string;
  achievement_card_is_public?: boolean;
  achievement_card_is_featured?: boolean;
  achievement_card_screenshots?: string[]; // 关联成果卡封面截图（精选管理页签展示用）
  
  // 关联数据（前端展示用）
  author_name?: string;
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

export interface CopyGuidanceNode {
  version?: string;
  intro_status: 'pending' | 'dismissed' | 'started';
  session_status: 'idle' | 'active' | 'waiting_verify' | 'completed';
  current_task?: {
    id?: string;
    title?: string;
  } | null;
  started_at?: string;
  updated_at?: string;
}

export interface ProjectProgress {
  current_stage: SkillStage;
  stage_history: Array<{ stage: SkillStage; started_at: string; completed_at?: string }>;
  light_step_data?: LightProjectStep1Data & LightProjectStep2Data & LightProjectStep3Data;
  standard_step_data?: Record<string, StandardProjectStepData>;
  teaching_mode?: 'guided' | 'demo' | 'hands_on' | 'lecture';
  // Q-017 记忆持久化：学生画像（问题标题→选中标签），刷新后从后端恢复避免 AI 失忆
  student_profile?: Record<string, string[]>;
  // MVP2 P0-03：复制项目任务引导状态节点，仅复制项目非空
  copy_guidance?: CopyGuidanceNode | null;
}

export interface FileEntry {
  name: string;
  language: string;
  content: string;
  is_main: boolean;
}

export interface ProjectWorkspaceData {
  code: string;
  language: string;
  filename?: string | null;
  chat_messages: Array<Record<string, unknown>>;
  preview_html: string;
  saved_at?: string | null;
  chat_saved_at?: string | null;
  files?: FileEntry[];
}

export interface ProjectWorkspaceResponse {
  project: Project;
  progress: ProjectProgress;
  workspace: ProjectWorkspaceData;
}

// 项目阶段文档
export interface ProjectDocument {
  stage: string;
  name: string;
  filename: string;
  has_content: boolean;
  summary: string;
  content_length: number;
}

export interface ProjectDocumentDetail {
  stage: string;
  name: string;
  filename: string;
  content: string;
  has_content: boolean;
}

// 代码模板
export interface CodeTemplate {
  id: string;
  title: string;
  description: string;
  language: string;
  icon: string;
  difficulty: string;
}

export interface CodeTemplateDetail extends CodeTemplate {
  code: string;
}

// 代码运行历史（前端 localStorage）
export interface RunHistoryEntry {
  id: string;
  timestamp: number;
  success: boolean;
  language: string;
  output: string;
  error?: string;
  code_preview: string;
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
  author_username?: string; // 作者显示名（管理页面 JOIN 返回，非落库字段）
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
  is_featured?: boolean;
  featured_sort_order?: number;
  featured_at?: string;
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

// 精选作品卡片（首页展示用，附带关联项目信息）
export interface FeaturedCard extends AchievementCard {
  project_name?: string;
  project_stage?: string;
}

export interface ShareTokenResponse {
  share_token: string;
  share_url: string;
}

export interface SubmitPublicRequest {
  submit_public: boolean;
}

// 项目截图候选项（来自 evidence 的 screenshot 类型）
export interface ScreenshotOption {
  id: string;
  title: string;
  url: string;
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

// 通知消息类型（后端 camelCase 输出）
export type NotificationType =
  | 'admin_message'
  | 'achievement_missing'
  | 'system'
  | 'project_featured'
  | 'demo_offshelf';

export type NotificationRelatedType = 'project' | 'achievement_card' | 'demo';

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string | null;
  type: NotificationType;
  title: string;
  content: string;
  relatedType: NotificationRelatedType | null;
  relatedId: string | null;
  linkUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationCreatePayload {
  recipientId?: string;
  recipientIds?: string[];
  broadcast?: boolean;
  type: NotificationType;
  title: string;
  content: string;
  relatedType?: NotificationRelatedType;
  relatedId?: string;
  linkUrl?: string;
}

export interface NotificationUnreadCount {
  unreadCount: number;
}

export interface NotificationMarkAllReadResult {
  updatedCount: number;
}

export interface NotificationBroadcastResult {
  count: number;
}
