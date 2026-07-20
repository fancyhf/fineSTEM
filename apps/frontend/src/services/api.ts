import {
  ApiResponse,
  PaginationResult,
  UserResponse,
  UserCreate,
  UserUpdate,
  ChangePasswordRequest,
  AuthResponse,
  Demo,
  ForkTemplate,
  DemoListQuery,
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectProgress,
  ProjectUpgrade,
  LightProjectStep1Data,
  LightProjectStep2Data,
  LightProjectStep3Data,
  StandardProjectStepData,
  ProjectWorkspaceResponse,
  FileEntry,
  ProjectDocument,
  ProjectDocumentDetail,
  CodeTemplate,
  CodeTemplateDetail,
  AchievementCard,
  AchievementCardCreate,
  AchievementCardUpdate,
  FeaturedCard,
  ShareTokenResponse,
  SubmitPublicRequest,
  ScreenshotOption,
  AchievementRecommendation,
  Evidence,
  EvidenceCreate,
  EvidenceUpdate,
  AutoEvidenceCollectRequest,
  SkillManifest,
  SkillRecord,
  SkillInstallRequest,
  AgentChatRequest,
  AgentChatResponse,
  Course,
  CourseCreate,
  CapabilityTagSuggestion,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// 认证 Token 管理
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: () => localStorage.removeItem(TOKEN_KEY),
  getUser: (): UserResponse | null => {
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  },
  setUser: (user: UserResponse) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  removeUser: () => localStorage.removeItem(USER_KEY),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  silent = false
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.headers && !Array.isArray(options.headers)) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  // 添加认证 Token
  const token = authStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API 边界层需要动态解析 JSON 结构
  let result: any;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    result = await response.json();
  } else {
    const text = await response.text();
    try { result = JSON.parse(text); } catch {
      result = { success: false, message: text.slice(0, 500), errors: [{ message: `服务器返回非JSON响应(${response.status})` }] };
    }
  }

  // 处理 401 未认证：silent 模式（后台 autosave 等）不跳转，仅抛错由调用方静默处理
  if (response.status === 401 && !silent) {
    authStorage.clear();
    window.location.href = '/login';
  }

  // 非 2xx 响应抛出异常，让调用方能正确处理错误（401 silent 模式也抛出）
  if (!response.ok) {
    const errorDetail = result?.detail || result?.message || `请求失败(${response.status})`;
    const error = new Error(errorDetail) as Error & { status: number; body: unknown };
    error.status = response.status;
    error.body = result;
    throw error;
  }

  return result;
}

async function requestText(
  endpoint: string,
  options: RequestInit = {}
): Promise<string> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {};
  if (options.headers && !Array.isArray(options.headers)) {
    Object.assign(headers, options.headers as Record<string, string>);
  }
  const token = authStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    authStorage.clear();
    window.location.href = '/login';
    return '';
  }

  if (!response.ok) {
    throw new Error('请求失败');
  }

  return response.text();
}

async function requestBlob(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ blob: Blob; fileName?: string }> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {};
  if (options.headers && !Array.isArray(options.headers)) {
    Object.assign(headers, options.headers as Record<string, string>);
  }
  const token = authStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    authStorage.clear();
    window.location.href = '/login';
  }
  if (!response.ok) {
    throw new Error('文件下载失败');
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  // 优先解析 RFC 5987 filename*=UTF-8''... 编码名称
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/);
  let fileName: string | undefined;
  if (utf8Match) {
    fileName = decodeURIComponent(utf8Match[1]);
  } else {
    const match = disposition.match(/filename="?([^";]+)"?/);
    fileName = match?.[1];
  }
  return { blob: await response.blob(), fileName };
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: unknown, silent = false) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }, silent),
  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  postForm: <T>(endpoint: string, formData: FormData) => {
    const token = authStorage.getToken();
    return fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    }).then(res => res.json() as Promise<ApiResponse<T>>);
  }
};

// 认证 API
export const authApi = {
  register: (data: UserCreate) => api.post<AuthResponse>('/auth/register', data),
  lightRegister: (name = '同学') => api.post<AuthResponse>('/auth/light-register', { name }),
  login: (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    return fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    }).then(async (res) => {
      const data = await res.json() as ApiResponse<AuthResponse>;
      // 后端返回的错误格式是 { detail: "错误信息" }，需要转换为前端期望的 { message: "错误信息" }
      const errorDetail = (data as ApiResponse<AuthResponse> & { detail?: string }).detail;
      if (!res.ok && !data.message && errorDetail) {
        data.message = errorDetail;
      } else if (!res.ok && !data.message) {
        data.message = `登录失败 (${res.status})`;
      }
      return data;
    });
  },
  getMe: () => api.get<UserResponse>('/auth/me'),
  updateMe: (data: UserUpdate) => api.patch<UserResponse>('/auth/me', data),
  changePassword: (data: ChangePasswordRequest) => api.post<null>('/auth/change-password', data),
};

// Demo API
export const demosApi = {
  list: (query?: DemoListQuery) => {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const queryString = params.toString();
    return api.get<PaginationResult<Demo>>(`/demos${queryString ? `?${queryString}` : ''}`);
  },
  get: (id: string) => api.get<Demo>(`/demos/${id}`),
  useAsTemplate: (id: string) => api.get<{ demo_id: string; name: string; description: string; tech_stack: string[]; difficulty: string; subjects: string[]; display_mode: string }>(`/demos/${id}/use-project`),
  getBreakdown: (id: string) =>
    api.get<{ demo_id: string; project_breakdown: string; minimal_replica?: string }>(`/demos/${id}/breakdown`),
  getForkTemplate: (id: string) =>
    api.get<ForkTemplate>(`/demos/${id}/fork-template`),
};

// Project API
export const projectsApi = {
  create: (data: ProjectCreate) => api.post<Project>('/projects', data),
  list: (params?: { page?: number; page_size?: number; mode?: string; stage?: string }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, String(value));
      });
    }
    return api.get<PaginationResult<Project>>(`/projects${query.toString() ? `?${query.toString()}` : ''}`);
  },
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  getProgress: (id: string) => api.get<ProjectProgress>(`/projects/${id}/progress`),
  getWorkspace: (id: string) => api.get<ProjectWorkspaceResponse>(`/projects/${id}/workspace`),
  generateAchievementCard: (id: string) => api.post<AchievementCard>(`/projects/${id}/achievement-generate`, {}),
  update: (id: string, data: ProjectUpdate) => api.patch<Project>(`/projects/${id}`, data),
  updateTeachingMode: (id: string, teachingMode: 'guided' | 'demo' | 'hands_on' | 'lecture') =>
    api.post<ProjectProgress>(`/projects/${id}/teaching-mode`, { teaching_mode: teachingMode }),
  delete: (id: string) => api.delete<void>(`/projects/${id}`),
  advanceStage: (id: string) => api.post<ProjectProgress>(`/projects/${id}/advance`, {}),
  // 轻量项目步骤
  saveLightStep1: (id: string, data: LightProjectStep1Data) =>
    api.post<ProjectProgress>(`/projects/${id}/progress/light/step1`, data),
  saveLightStep2: (id: string, data: LightProjectStep2Data) =>
    api.post<ProjectProgress>(`/projects/${id}/progress/light/step2`, data),
  saveLightStep3: (id: string, data: LightProjectStep3Data) =>
    api.post<ProjectProgress>(`/projects/${id}/progress/light/step3`, data),
  // 标准项目步骤
  saveStandardStep: (id: string, step: number, data: StandardProjectStepData) =>
    api.post<ProjectProgress>(`/projects/${id}/progress/standard/${step}`, data),
  // 升级项目
  upgrade: (id: string, data: ProjectUpgrade) =>
    api.post<Project>(`/projects/${id}/upgrade`, data),
  export: (id: string, format: 'json' | 'md' = 'md') =>
    requestText(`/projects/${id}/export?format=${format}`, { method: 'GET' }),
  exportFile: (id: string, format: 'json' | 'md' | 'zip' | 'pdf' | 'docx') =>
    requestBlob(`/projects/${id}/export?format=${format}`, { method: 'GET' }),
  // 代码持久化（autosave：静默模式，401 不跳转）
  saveCode: (id: string, data: { code: string; language?: string; filename?: string; files?: FileEntry[]; preview_html?: string }) =>
    api.post<{ saved: boolean; project_id: string }>(`/projects/${id}/code`, data, true).then((res) => {
      if (!res.data?.saved) {
        throw new Error(res.message || '代码保存失败');
      }
      return res;
    }),
  getCode: (id: string) =>
    api.get<{ code: string; language: string; filename?: string; has_code: boolean }>(`/projects/${id}/code`),
  // 聊天记录持久化（autosave：静默模式，401 不跳转）
  saveChatHistory: (id: string, data: { messages: unknown[] }) =>
    api.post<{ saved: boolean; message_count: number; project_id: string }>(`/projects/${id}/chat`, data, true).then((res) => {
      if (!res.data?.saved) {
        throw new Error(res.message || '聊天记录保存失败');
      }
      return res;
    }),
  getChatHistory: (id: string) =>
    api.get<{ messages: unknown[]; message_count: number; has_messages: boolean; saved_at?: string }>(`/projects/${id}/chat`),
  // 项目阶段文档
  listDocuments: (id: string) =>
    api.get<ProjectDocument[]>(`/projects/${id}/documents`),
  getDocument: (id: string, stage: string) =>
    api.get<ProjectDocumentDetail>(`/projects/${id}/documents/${stage}`),
};

// 成就卡片 API
export const achievementCardsApi = {
  create: (projectId: string, data: AchievementCardCreate) =>
    api.post<AchievementCard>(`/achievement-cards/projects/${projectId}`, data),
  getByProject: (projectId: string) =>
    api.get<AchievementCard>(`/achievement-cards/projects/${projectId}`),
  /** 读取 AI 生成的成果卡草稿（Markdown 文件 → 结构化数据桥梁） */
  getDraft: (projectId: string) =>
    api.get<Record<string, unknown> | null>(`/projects/${projectId}/achievement-draft`),
  update: (id: string, data: AchievementCardUpdate) =>
    api.patch<AchievementCard>(`/achievement-cards/${id}`, data),
  createShareLink: (id: string) =>
    api.post<ShareTokenResponse>(`/achievement-cards/${id}/share`, {}),
  getShared: (token: string) =>
    api.get<AchievementCard>(`/achievement-cards/share/${token}`),
  /** 按 ID 查看公开成果档案卡（无需登录，私有卡 404） */
  getPublic: (id: string) =>
    api.get<AchievementCard>(`/achievement-cards/${id}`),
  submitPublic: (id: string, data: SubmitPublicRequest = { submit_public: true }) =>
    api.post<AchievementCard>(`/achievement-cards/${id}/submit-public`, data),
  withdrawPublic: (id: string) =>
    api.post<AchievementCard>(`/achievement-cards/${id}/withdraw-public`, {}),
  forkProjectFromCard: (id: string) =>
    api.post<Project>(`/achievement-cards/${id}/fork-project`, {}),
  recommendations: (id: string) =>
    api.get<AchievementRecommendation[]>(`/achievement-cards/${id}/recommendations`),
  listPublic: (params?: { page?: number; page_size?: number; capability_tag?: string; project_mode?: string; sort_by?: string }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, String(value));
      });
    }
    return api.get<PaginationResult<AchievementCard>>(`/achievement-cards/inspiration-wall${query.toString() ? `?${query.toString()}` : ''}`);
  },
  /** 首页精选作品（无需登录） */
  listFeatured: (params?: { page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) query.append(key, String(value));
      });
    }
    return api.get<PaginationResult<FeaturedCard>>(`/achievement-cards/featured${query.toString() ? `?${query.toString()}` : ''}`);
  },
  /** 管理员设置/取消精选 */
  setFeatured: (id: string, featured: boolean, sortOrder = 0) =>
    api.post<AchievementCard>(`/achievement-cards/${id}/feature`, { featured, sort_order: sortOrder }),
  /** 生成 AI 封面图（作者本人） */
  generateCover: (id: string) =>
    api.post<AchievementCard>(`/achievement-cards/${id}/generate-cover`, {}),
  /** 上传图片作为封面（作者本人） */
  uploadCover: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.postForm<AchievementCard>(`/achievement-cards/${id}/upload-cover`, formData);
  },
  /** 获取项目截图列表（用于选择封面） */
  listProjectScreenshots: (projectId: string) =>
    api.get<ScreenshotOption[]>(`/achievement-cards/projects/${projectId}/screenshots`),
};

// 证据 API
export const evidenceApi = {
  create: (projectId: string, data: EvidenceCreate) =>
    api.post<Evidence>(`/evidence/projects/${projectId}`, data),
  list: (projectId: string, params?: { page?: number; page_size?: number; type?: string }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, String(value));
      });
    }
    return api.get<PaginationResult<Evidence>>(`/evidence/projects/${projectId}${query.toString() ? `?${query.toString()}` : ''}`);
  },
  get: (id: string) => api.get<Evidence>(`/evidence/${id}`),
  update: (id: string, data: EvidenceUpdate) =>
    api.patch<Evidence>(`/evidence/${id}`, data),
  autoCollect: (projectId: string, data: AutoEvidenceCollectRequest) =>
    api.post<Evidence>(`/evidence/projects/${projectId}/auto-collect`, data),
  uploadScreenshot: (projectId: string, file: File, relatedStep?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (relatedStep) formData.append('related_step', relatedStep);
    return api.postForm<Evidence>(`/evidence/projects/${projectId}/screenshots`, formData);
  },
};

// Skill API
export const skillsApi = {
  marketplace: () => api.get<SkillManifest[]>('/skills/marketplace'),
  listInstalled: () => api.get<SkillRecord[]>('/skills'),
  install: (data: SkillInstallRequest) => api.post<SkillRecord>('/skills/install', data),
  toggle: (skillId: string, enabled: boolean) =>
    api.post<SkillRecord>(`/skills/${skillId}/toggle`, { enabled }),
  uninstall: (skillId: string) => api.delete<boolean>(`/skills/${skillId}`),
};

// Agent API
export const agentApi = {
  chat: (data: AgentChatRequest) => api.post<AgentChatResponse>('/agent/chat', data),
  streamUrl: (message: string, projectId?: string) => {
    const query = new URLSearchParams({ message });
    if (projectId) query.append('project_id', projectId);
    return `${API_BASE_URL}/agent/stream?${query.toString()}`;
  },
  metrics: () => api.get<Record<string, number>>('/agent/metrics'),
};

export const documentsApi = {
  generate: (
    projectId: string,
    documentType: 'proposal' | 'technical' | 'final',
    format: 'md' | 'json' | 'pdf' | 'docx',
  ) => requestBlob(`/documents/projects/${projectId}/generate?document_type=${documentType}&format=${format}`, { method: 'GET' }),
};

export const capabilityTagsApi = {
  recommend: (projectId: string) => api.get<CapabilityTagSuggestion>(`/capability-tags/projects/${projectId}/recommend`),
  apply: (projectId: string, tags: string[]) => api.post<string[]>(`/capability-tags/projects/${projectId}/apply`, { tags }),
  get: (projectId: string) => api.get<string[]>(`/capability-tags/projects/${projectId}`),
};

export const coursesApi = {
  listCourses: () => api.get<Course[]>('/courses'),
  createCourse: (data: CourseCreate) => api.post<Course>('/courses', data),
};

export const codeExecutionApi = {
  execute: (code: string, language: string = 'python', files?: FileEntry[]) =>
    api.post<{ success: boolean; output: string; error?: string; exit_code?: number; mode?: string; preview_url?: string }>(
      '/code/execute',
      { code, language, files },
    ),
  // 代码模板
  listTemplates: () =>
    api.get<CodeTemplate[]>('/code/templates'),
  getTemplate: (id: string) =>
    api.get<CodeTemplateDetail>(`/code/templates/${id}`),
  /** 对当前项目运行预览自动截图，并登记为项目 screenshot 证据 */
  capturePreview: (projectId: string, opts?: { previewUrl?: string; html?: string; relatedStep?: string; fullPage?: boolean }) =>
    api.post<ScreenshotOption>(
      '/code/capture-preview',
      {
        project_id: projectId,
        preview_url: opts?.previewUrl,
        html: opts?.html,
        related_step: opts?.relatedStep,
        full_page: opts?.fullPage ?? false,
      },
    ),
};
